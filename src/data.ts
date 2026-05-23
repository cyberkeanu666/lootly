/**
 * Lootly - Professional Provably Fair Giveaway Platform Metadata Types
 */

export interface Giveaway {
  id: string;
  hostId: string;
  title: string;
  prize: string;
  prizeDescription: string;
  prizeImageURL: string;
  slug: string;
  requiredProfiles: string[]; // List of Instagram handles to follow, e.g. ["meta", "cristiano"]
  drawDate: string; // ISO date format
  status: 'draft' | 'active' | 'drawing' | 'completed';
  seedHash: string; // Pre-calculated SHA-256 hash of secret seed
  seed: string | null; // Keeps null until the draw time is triggered for cryptographic integrity
  maxParticipants: number | null; // Optional entry limits
  numWinners: number;
  mode: 'verified' | 'simple'; // Verified: bio code check | Simple: honor system
  referralBonusTickets: number; // e.g. 1 bonus ticket per X invites
  createdAt: string;
  watermark: boolean; // Freemium watermark state
  trafficSources: {
    direct: number;
    referral: number;
    social: number;
    search: number;
  };
  peakHours: Record<string, number>; // Hour of day -> join count
  winners: string[]; // List of winner Instagram usernames
  disqualifiedList: { username: string; reason: string }[];
}

export interface Participant {
  id: string;               // Unique ID
  giveawayId: string;       // References Giveaway.id
  instagramUsername: string; // User's Instagram handle
  verifiedAt: string | null; // ISO date of successful bio-checks
  ticketCount: number;      // Ticket weight (1 basic + referral bonuses)
  referredBy: string | null;// Username who referred them
  verificationCode: string; // Unique generated string e.g. "LOOTLY-X7K2-XYZ"
  verificationExpiresAt: string; // ISO timestamp
  verificationAttempts: number; // 0 to 3
  ipAddress: string;        // Client IP limit guard
  email?: string;           // Optional subscription mail
  joinedAt: string;
}

export interface VerificationLog {
  id: string;
  giveawayId: string;
  instagramUsername: string;
  checkedAt: string;
  result: 'passed' | 'failed' | 'disqualified';
  failedProfiles: string[];
  message: string;
}

export interface Referral {
  id: string;
  giveawayId: string;
  referrerUsername: string;
  newParticipantUsername: string;
  createdAt: string;
}

export interface HostUser {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  createdAt: string;
  username: string;
  /** Stored server-side only; never returned to the client */
  passwordHash?: string;
}

export interface LocalDatabaseSchema {
  hosts: HostUser[];
  giveaways: Giveaway[];
  participants: Participant[];
  logs: VerificationLog[];
  referrals: Referral[];
}
