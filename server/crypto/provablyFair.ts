import crypto from 'crypto';

/** 32-byte hex seed per lootly-docs.html */
export function generateCampaignSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

export function verifySeedAgainstHash(seed: string, publishedHash: string): boolean {
  return hashSeed(seed) === publishedHash;
}

/** Build weighted ticket pool (sorted usernames, expanded by ticketCount). */
export function buildTicketPool(
  verifiedParticipants: { instagramUsername: string; ticketCount: number }[]
): string[] {
  const sortedUsernames = verifiedParticipants
    .map((p) => p.instagramUsername)
    .sort();
  const pool: string[] = [];
  for (const username of sortedUsernames) {
    const p = verifiedParticipants.find((part) => part.instagramUsername === username);
    const tickets = p?.ticketCount ?? 1;
    for (let i = 0; i < tickets; i++) {
      pool.push(username);
    }
  }
  return pool;
}

export function computeDrawHash(seed: string, ticketPool: string[]): string {
  return crypto.createHash('sha256').update(`${seed}_${ticketPool.join(',')}`).digest('hex');
}

export function pickWinnerIndex(seed: string, ticketPool: string[]): number {
  if (ticketPool.length === 0) return -1;
  const drawHashHex = computeDrawHash(seed, ticketPool);
  const hashBigInt = BigInt(`0x${drawHashHex}`);
  return Number(hashBigInt % BigInt(ticketPool.length));
}

export interface DrawRoundResult {
  winner: string;
  drawHash: string;
  winnerIndex: number;
}

export function runProvablyFairDraw(
  seed: string,
  verifiedParticipants: { instagramUsername: string; ticketCount: number }[],
  numWinners: number
): { winners: string[]; ticketPool: string[]; rounds: DrawRoundResult[] } {
  let roster = buildTicketPool(verifiedParticipants);
  const originalPool = [...roster];
  const winners: string[] = [];
  const rounds: DrawRoundResult[] = [];

  while (winners.length < numWinners && roster.length > 0) {
    const winnerIndex = pickWinnerIndex(seed, roster);
    const winner = roster[winnerIndex];
    const drawHash = computeDrawHash(seed, roster);
    rounds.push({ winner, drawHash, winnerIndex });
    winners.push(winner);
    roster = roster.filter((u) => u !== winner);
  }

  return { winners, ticketPool: originalPool, rounds };
}

/** Public sandbox calculator — same formula as live draw. */
export function sandboxVerifyWinner(
  seed: string,
  sortedParticipantCommaList: string
): {
  orderedList: string[];
  formulaInput: string;
  sha256Result: string;
  decimalBigInt: string;
  resolvedIndex: number;
  winnerUsername: string;
} {
  const arr = sortedParticipantCommaList
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  const formulaInput = `${seed}_${arr.join(',')}`;
  const calculatedHash = crypto.createHash('sha256').update(formulaInput).digest('hex');
  const bInt = BigInt(`0x${calculatedHash}`);
  const index = arr.length > 0 ? Number(bInt % BigInt(arr.length)) : -1;
  return {
    orderedList: arr,
    formulaInput,
    sha256Result: calculatedHash,
    decimalBigInt: bInt.toString(),
    resolvedIndex: index,
    winnerUsername: index >= 0 ? arr[index] : '',
  };
}
