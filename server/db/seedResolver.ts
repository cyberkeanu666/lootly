import fs from 'fs';
import path from 'path';
import {
  generateCampaignSeed,
  hashSeed,
  verifySeedAgainstHash,
} from '../crypto/provablyFair.js';
import { getCampaignSeed, readDatabase, storeCampaignSeed, writeDatabase } from './repository.js';

/** Known demo seeds from original seed comments (when still valid). */
const LEGACY_DEMO_SEEDS: Record<string, string> = {
  g_completed: 'makeover_done_99',
};

export async function resolveCampaignSeed(
  giveawayId: string,
  publishedSeedHash: string
): Promise<string | null> {
  const stored = await getCampaignSeed(giveawayId);
  if (stored && verifySeedAgainstHash(stored, publishedSeedHash)) {
    return stored;
  }

  const legacyDemo = LEGACY_DEMO_SEEDS[giveawayId];
  if (legacyDemo && verifySeedAgainstHash(legacyDemo, publishedSeedHash)) {
    await storeCampaignSeed(giveawayId, legacyDemo);
    return legacyDemo;
  }

  const legacyRootPath = path.resolve(process.cwd(), `seed_${giveawayId}.secret`);
  if (fs.existsSync(legacyRootPath)) {
    const legacy = fs.readFileSync(legacyRootPath, 'utf8').trim();
    if (verifySeedAgainstHash(legacy, publishedSeedHash)) {
      await storeCampaignSeed(giveawayId, legacy);
      return legacy;
    }
  }

  return null;
}

/** Fix giveaways whose secret was lost (demo migration / dev). Re-keys seedHash to match new secret. */
export async function repairMissingGiveawaySecrets(): Promise<void> {
  const db = await readDatabase();
  let changed = false;

  for (const giveaway of db.giveaways) {
    const ok = await resolveCampaignSeed(giveaway.id, giveaway.seedHash);
    if (ok) continue;

    const newSeed = generateCampaignSeed();
    giveaway.seedHash = hashSeed(newSeed);
    giveaway.seed = null;
    await storeCampaignSeed(giveaway.id, newSeed);
    changed = true;
    console.warn(
      `[Lootly Seed] Re-keyed missing secret for giveaway ${giveaway.id} (${giveaway.slug})`
    );
  }

  if (changed) await writeDatabase(db);
}
