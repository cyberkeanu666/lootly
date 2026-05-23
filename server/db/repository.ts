import crypto from 'crypto';
import type { Giveaway, HostUser, LocalDatabaseSchema, Participant, Referral, VerificationLog } from './types.js';
import {
  initFirestore,
  isFirestoreActive,
  loadFullDatabaseFromFirestore,
  loadGiveawaySecret,
  mirrorDatabaseToFirestore,
  saveGiveawaySecret,
} from './firestoreStore.js';
import { readLocalDatabase, readLocalSecret, writeLocalDatabase, writeLocalSecret } from './localStore.js';
import { generateCampaignSeed, hashSeed } from '../crypto/provablyFair.js';

const EMPTY_DB: LocalDatabaseSchema = {
  hosts: [],
  giveaways: [],
  participants: [],
  logs: [],
  referrals: [],
};

let memoryCache: LocalDatabaseSchema | null = null;

/** Serializes JSON-path participant writes per giveaway + username. */
const jsonMutexChains = new Map<string, Promise<void>>();

async function withJsonMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = jsonMutexChains.get(key) ?? Promise.resolve();
  let unlock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const next = prev.then(() => gate);
  jsonMutexChains.set(key, next);

  await prev;
  try {
    return await fn();
  } finally {
    unlock();
    if (jsonMutexChains.get(key) === next) {
      jsonMutexChains.delete(key);
    }
  }
}

export async function readDatabase(): Promise<LocalDatabaseSchema> {
  initFirestore();

  if (isFirestoreActive()) {
    const remote = await loadFullDatabaseFromFirestore();
    const data: LocalDatabaseSchema = remote ?? { ...EMPTY_DB };
    memoryCache = data;
    return data;
  }

  const local = readLocalDatabase();
  memoryCache = local;
  return local;
}

export async function writeDatabase(data: LocalDatabaseSchema): Promise<void> {
  memoryCache = data;

  initFirestore();
  if (isFirestoreActive()) {
    await mirrorDatabaseToFirestore(data);
    return;
  }

  writeLocalDatabase(data);
}

export async function getCampaignSeed(giveawayId: string): Promise<string | null> {
  const fromFs = await loadGiveawaySecret(giveawayId);
  if (fromFs) return fromFs;
  return readLocalSecret(giveawayId);
}

export async function storeCampaignSeed(giveawayId: string, seed: string): Promise<void> {
  writeLocalSecret(giveawayId, seed);
  await saveGiveawaySecret(giveawayId, seed);
}

/**
 * Atomically register a participant if the username is not already verified
 * for this giveaway (prevents concurrent join race conditions).
 */
export async function atomicParticipantLock(
  giveawayId: string,
  instagramUsername: string,
  newParticipant: Participant
): Promise<{ success: boolean; error?: string }> {
  const handle = instagramUsername.replace('@', '').trim().toLowerCase();

  initFirestore();
  if (isFirestoreActive()) {
    const { db } = initFirestore();
    if (!db) {
      return { success: false, error: 'Firestore unavailable.' };
    }

    try {
      await db.runTransaction(async (tx) => {
        const conflictQuery = db
          .collection('participants')
          .where('giveawayId', '==', giveawayId)
          .where('instagramUsername', '==', handle);
        const conflictSnap = await tx.get(conflictQuery);

        const verifiedConflict = conflictSnap.docs.some(
          (doc) => !!(doc.data() as Participant).verifiedAt
        );
        if (verifiedConflict) {
          throw new Error('USERNAME_VERIFIED');
        }

        tx.set(db.collection('participants').doc(newParticipant.id), newParticipant);
      });
      return { success: true };
    } catch (err) {
      if (err instanceof Error && err.message === 'USERNAME_VERIFIED') {
        return {
          success: false,
          error: `Instagram user @${handle} is already verified in this giveaway.`,
        };
      }
      console.error('[atomicParticipantLock] Firestore transaction failed:', err);
      return { success: false, error: 'Could not register participant atomically.' };
    }
  }

  const lockKey = `${giveawayId}:${handle}`;
  return withJsonMutex(lockKey, async () => {
    const db = await readDatabase();
    const verifiedConflict = db.participants.some(
      (p) =>
        p.giveawayId === giveawayId &&
        p.instagramUsername === handle &&
        p.verifiedAt !== null
    );
    if (verifiedConflict) {
      return {
        success: false,
        error: `Instagram user @${handle} is already verified in this giveaway.`,
      };
    }

    const alreadyPending = db.participants.some((p) => p.id === newParticipant.id);
    if (!alreadyPending) {
      db.participants.push(newParticipant);
    }
    await writeDatabase(db);
    return { success: true };
  });
}

export async function createGiveawayWithSeed(
  payload: Omit<Giveaway, 'id' | 'seedHash' | 'seed' | 'createdAt'> & { hostId: string }
): Promise<{ giveaway: Giveaway; seed: string }> {
  const seed = generateCampaignSeed();
  const seedHash = hashSeed(seed);
  const giveaway: Giveaway = {
    ...payload,
    id: 'g_' + crypto.randomUUID().split('-')[0],
    seedHash,
    seed: null,
    createdAt: new Date().toISOString(),
  } as Giveaway;

  await storeCampaignSeed(giveaway.id, seed);
  const db = await readDatabase();
  db.giveaways.push(giveaway);
  await writeDatabase(db);
  return { giveaway, seed };
}

export function generateVerificationCode(giveawayId: string): string {
  const prefixRandom = Math.floor(1000 + Math.random() * 9000).toString();
  return `LOOTLY-${prefixRandom}-${giveawayId.toUpperCase().slice(-4)}`;
}

export async function applyVerifiedParticipant(
  participantId: string,
  logMessage: string
): Promise<{ success: boolean; error?: string; participant?: Participant }> {
  const db = await readDatabase();
  const participant = db.participants.find((p) => p.id === participantId);
  if (!participant) return { success: false, error: 'Registration record expired/missing.' };

  if (new Date() > new Date(participant.verificationExpiresAt)) {
    return { success: false, error: 'Your code signature has expired! Request a new verification code.' };
  }

  const isAlreadyTaken = db.participants.some(
    (p) =>
      p.giveawayId === participant.giveawayId &&
      p.instagramUsername === participant.instagramUsername &&
      p.verifiedAt !== null &&
      p.id !== participantId
  );
  if (isAlreadyTaken) {
    participant.verificationAttempts = 3;
    await writeDatabase(db);
    return {
      success: false,
      error: `Conflict: @${participant.instagramUsername} was verified on another device first.`,
    };
  }

  participant.verifiedAt = new Date().toISOString();
  participant.ticketCount = 1;

  if (participant.referredBy) {
    const referrer = db.participants.find(
      (p) =>
        p.giveawayId === participant.giveawayId &&
        p.instagramUsername === participant.referredBy &&
        p.verifiedAt !== null
    );
    if (referrer) {
      const giveaway = db.giveaways.find((g) => g.id === participant.giveawayId);
      referrer.ticketCount += giveaway?.referralBonusTickets ?? 1;
      db.referrals.push({
        id: 'ref_' + crypto.randomUUID().split('-')[0],
        giveawayId: participant.giveawayId,
        referrerUsername: referrer.instagramUsername,
        newParticipantUsername: participant.instagramUsername,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const logEntry: VerificationLog = {
    id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
    giveawayId: participant.giveawayId,
    instagramUsername: participant.instagramUsername,
    checkedAt: new Date().toISOString(),
    result: 'passed',
    failedProfiles: [],
    message: logMessage,
  };
  db.logs.unshift(logEntry);
  await writeDatabase(db);
  return { success: true, participant };
}

export async function recordFailedVerification(
  participantId: string,
  message: string
): Promise<{ attempts: number }> {
  const db = await readDatabase();
  const participant = db.participants.find((p) => p.id === participantId);
  if (!participant) return { attempts: 0 };
  participant.verificationAttempts += 1;
  const logEntry: VerificationLog = {
    id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 100),
    giveawayId: participant.giveawayId,
    instagramUsername: participant.instagramUsername,
    checkedAt: new Date().toISOString(),
    result: 'failed',
    failedProfiles: [],
    message,
  };
  db.logs.unshift(logEntry);
  await writeDatabase(db);
  return { attempts: participant.verificationAttempts };
}

export type { HostUser, Giveaway, Participant, VerificationLog, Referral, LocalDatabaseSchema };
