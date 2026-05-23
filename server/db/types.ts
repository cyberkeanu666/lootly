export type {
  Giveaway,
  Participant,
  VerificationLog,
  Referral,
  HostUser,
  LocalDatabaseSchema,
} from '../../src/data.js';

export interface GiveawaySecret {
  giveawayId: string;
  seed: string;
  createdAt: string;
}
