import fs from 'fs';
import path from 'path';
import type { LocalDatabaseSchema } from './types.js';

const dbFilePath = path.resolve(process.cwd(), 'local_db.json');

const EMPTY_DB: LocalDatabaseSchema = {
  hosts: [],
  giveaways: [],
  participants: [],
  logs: [],
  referrals: [],
};

export function getLocalDbPath(): string {
  return dbFilePath;
}

export function readLocalDatabase(): LocalDatabaseSchema {
  if (!fs.existsSync(dbFilePath)) {
    fs.writeFileSync(dbFilePath, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
    return { ...EMPTY_DB };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(dbFilePath, 'utf8')) as LocalDatabaseSchema;
    if (!parsed?.hosts || !parsed?.giveaways) {
      fs.writeFileSync(dbFilePath, JSON.stringify(EMPTY_DB, null, 2), 'utf8');
      return { ...EMPTY_DB };
    }
    parsed.participants = parsed.participants ?? [];
    parsed.logs = parsed.logs ?? [];
    parsed.referrals = parsed.referrals ?? [];
    return parsed;
  } catch {
    return { ...EMPTY_DB };
  }
}

export function writeLocalDatabase(data: LocalDatabaseSchema): void {
  fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf8');
}

const secretsDir = path.resolve(process.cwd(), '.lootly_secrets');

export function writeLocalSecret(giveawayId: string, seed: string): void {
  if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir, { recursive: true });
  fs.writeFileSync(path.join(secretsDir, `${giveawayId}.secret`), seed, 'utf8');
}

export function readLocalSecret(giveawayId: string): string | null {
  const p = path.join(secretsDir, `${giveawayId}.secret`);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}
