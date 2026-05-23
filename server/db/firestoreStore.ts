import fs from 'fs';
import path from 'path';
import * as admin from 'firebase-admin';
import type {
  Giveaway,
  HostUser,
  LocalDatabaseSchema,
  Participant,
  Referral,
  VerificationLog,
} from './types.js';

let firestoreDb: FirebaseFirestore.Firestore | null = null;
let useRealFirebase = false;

export function initFirestore(): { db: FirebaseFirestore.Firestore | null; isReal: boolean } {
  if (firestoreDb) return { db: firestoreDb, isReal: useRealFirebase };

  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : null;

  try {
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      firestoreDb = admin.firestore();
      useRealFirebase = true;
      console.log('[Lootly Database] Firestore via service account.');
    } else if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!admin.apps.length) {
        admin.initializeApp({ projectId: config.projectId });
      }
      firestoreDb = admin.firestore();
      useRealFirebase = true;
      console.log('[Lootly Database] Firestore via applet config.');
    } else if (process.env.FIREBASE_PROJECT_ID) {
      if (!admin.apps.length) {
        admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      }
      firestoreDb = admin.firestore();
      useRealFirebase = true;
      console.log('[Lootly Database] Firestore via FIREBASE_PROJECT_ID.');
    }
  } catch (error) {
    console.error('[Lootly Database] Firestore init failed, using local mirror only:', error);
  }

  return { db: firestoreDb, isReal: useRealFirebase };
}

export function isFirestoreActive(): boolean {
  return useRealFirebase && !!firestoreDb;
}

export async function loadFullDatabaseFromFirestore(): Promise<LocalDatabaseSchema | null> {
  const { db, isReal } = initFirestore();
  if (!isReal || !db) return null;

  const [hostsSnap, giveawaysSnap, participantsSnap, logsSnap, referralsSnap] =
    await Promise.all([
      db.collection('users').get(),
      db.collection('giveaways').get(),
      db.collection('participants').get(),
      db.collection('verification_log').get(),
      db.collection('referrals').get(),
    ]);

  return {
    hosts: hostsSnap.docs.map((d) => d.data() as HostUser),
    giveaways: giveawaysSnap.docs.map((d) => d.data() as Giveaway),
    participants: participantsSnap.docs.map((d) => d.data() as Participant),
    logs: logsSnap.docs.map((d) => d.data() as VerificationLog),
    referrals: referralsSnap.docs.map((d) => d.data() as Referral),
  };
}

export async function mirrorDatabaseToFirestore(data: LocalDatabaseSchema): Promise<void> {
  const { db, isReal } = initFirestore();
  if (!isReal || !db) return;

  try {
    const batch = db.batch();
    data.hosts.forEach((h) => batch.set(db.collection('users').doc(h.id), h));
    data.giveaways.forEach((g) => batch.set(db.collection('giveaways').doc(g.id), g));
    data.participants.slice(-500).forEach((p) =>
      batch.set(db.collection('participants').doc(p.id), p)
    );
    data.logs.slice(0, 200).forEach((l) =>
      batch.set(db.collection('verification_log').doc(l.id), l)
    );
    data.referrals.slice(-200).forEach((r) =>
      batch.set(db.collection('referrals').doc(r.id), r)
    );
    await batch.commit();
  } catch (err) {
    console.error('[Firestore Mirror] batch failed:', err);
  }
}

export async function saveGiveawaySecret(giveawayId: string, seed: string): Promise<void> {
  const { db, isReal } = initFirestore();
  if (!isReal || !db) return;
  await db.collection('giveaway_secrets').doc(giveawayId).set({
    giveawayId,
    seed,
    createdAt: new Date().toISOString(),
  });
}

export async function loadGiveawaySecret(giveawayId: string): Promise<string | null> {
  const { db, isReal } = initFirestore();
  if (!isReal || !db) return null;
  const doc = await db.collection('giveaway_secrets').doc(giveawayId).get();
  if (!doc.exists) return null;
  return (doc.data() as { seed: string }).seed ?? null;
}

/** Atomic username lock after successful verification. */
export async function verifyParticipantAtomic(
  participantId: string,
  onVerified: (data: LocalDatabaseSchema) => {
    participant: Participant;
    log: VerificationLog;
    data: LocalDatabaseSchema;
  } | null
): Promise<{ success: boolean; error?: string; participant?: Participant }> {
  const { db, isReal } = initFirestore();
  if (!isReal || !db) return { success: false, error: 'NO_FIRESTORE' };

  return db.runTransaction(async (tx) => {
    const partRef = db.collection('participants').doc(participantId);
    const partSnap = await tx.get(partRef);
    if (!partSnap.exists) return { success: false, error: 'NOT_FOUND' };

    const participant = partSnap.data() as Participant;
    if (participant.verifiedAt) return { success: false, error: 'ALREADY_VERIFIED' };

    const conflictQuery = await db
      .collection('participants')
      .where('giveawayId', '==', participant.giveawayId)
      .where('instagramUsername', '==', participant.instagramUsername)
      .get();

    const verifiedConflict = conflictQuery.docs.some(
      (d) => d.id !== participantId && !!(d.data() as Participant).verifiedAt
    );
    if (verifiedConflict) {
      return { success: false, error: 'USERNAME_LOCKED' };
    }

    const local = await loadFullDatabaseFromFirestore();
    if (!local) return { success: false, error: 'LOAD_FAILED' };

    const result = onVerified(local);
    if (!result) return { success: false, error: 'VERIFY_REJECTED' };

    tx.set(partRef, result.participant);
    tx.set(db.collection('verification_log').doc(result.log.id), result.log);

    return { success: true, participant: result.participant };
  });
}
