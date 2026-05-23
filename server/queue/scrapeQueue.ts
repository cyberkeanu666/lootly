import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { scrapeInstagramBioForCode } from '../scraper/instagramBio.js';
import {
  applyVerifiedParticipant,
  readDatabase,
  recordFailedVerification,
  writeDatabase,
} from '../db/repository.js';

export const SCRAPE_QUEUE_NAME = 'lootly-bio-scrape';

export type ScrapeJobData = {
  jobId: string;
  participantId: string;
  instagramUsername: string;
  verificationCode: string;
};

export type ScrapeJobState = {
  id: string;
  participantId?: string;
  status: 'queued' | 'active' | 'scraping' | 'completed' | 'failed';
  stage?: string;
  success?: boolean;
  message?: string;
  attempts?: number;
  source?: string;
  participant?: import('../db/types.js').Participant;
  updatedAt: string;
};

const jobStatusStore = new Map<string, ScrapeJobState>();

let scrapeQueue: Queue<ScrapeJobData> | null = null;
let scrapeWorker: Worker<ScrapeJobData> | null = null;

export function isBullMqActive(): boolean {
  return scrapeQueue !== null;
}

function setJobStatus(id: string, patch: Partial<ScrapeJobState>) {
  const prev = jobStatusStore.get(id);
  jobStatusStore.set(id, {
    id,
    status: 'queued',
    updatedAt: new Date().toISOString(),
    ...prev,
    ...patch,
  });
}

export function getScrapeJobStatus(jobId: string): ScrapeJobState | null {
  return jobStatusStore.get(jobId) ?? null;
}

async function processScrapeJob(data: ScrapeJobData): Promise<void> {
  const { jobId, participantId, instagramUsername, verificationCode } = data;
  setJobStatus(jobId, { status: 'active', stage: 'Loading scraper worker...' });

  const db = await readDatabase();
  const participant = db.participants.find((p) => p.id === participantId);
  if (!participant) {
    setJobStatus(jobId, { status: 'failed', message: 'Participant not found.' });
    return;
  }

  if (participant.verificationAttempts >= 3) {
    setJobStatus(jobId, {
      status: 'failed',
      message: 'Max 3 verification attempts reached.',
      attempts: participant.verificationAttempts,
    });
    return;
  }

  setJobStatus(jobId, { status: 'scraping', stage: `Crawling instagram.com/${instagramUsername}...` });

  const scrape = await scrapeInstagramBioForCode(instagramUsername, verificationCode);

  if (scrape.codeFound) {
    const verified = await applyVerifiedParticipant(
      participantId,
      `Bio verified via ${scrape.source}. Code matched: ${verificationCode}`
    );
    if (verified.success && verified.participant) {
      setJobStatus(jobId, {
        status: 'completed',
        success: true,
        message: 'Bio signature verified successfully!',
        source: scrape.source,
        attempts: participant.verificationAttempts,
        participant: verified.participant,
      });
      return;
    }
    setJobStatus(jobId, {
      status: 'failed',
      success: false,
      message: verified.error || 'Verification conflict.',
    });
    return;
  }

  const failed = await recordFailedVerification(
    participantId,
    scrape.error ||
      `Code not found in bio (source: ${scrape.source}). Paste ${verificationCode} exactly in your public bio.`
  );

  setJobStatus(jobId, {
    status: 'completed',
    success: false,
    message:
      'Verification code not found in Instagram bio. Ensure your profile is public and the code matches exactly.',
    attempts: failed.attempts,
    source: scrape.source,
  });
}

export async function enqueueBioScrapeJob(data: ScrapeJobData): Promise<string> {
  setJobStatus(data.jobId, {
    status: 'queued',
    stage: 'Queued in BullMQ...',
    participantId: data.participantId,
  });

  if (scrapeQueue) {
    await scrapeQueue.add('scrape-bio', data, {
      jobId: data.jobId,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    return data.jobId;
  }

  setJobStatus(data.jobId, { status: 'active', stage: 'Processing inline (no Redis)...' });
  try {
    await processScrapeJob(data);
  } catch (err) {
    setJobStatus(data.jobId, {
      status: 'failed',
      message: err instanceof Error ? err.message : 'Scrape worker error',
    });
  }
  return data.jobId;
}

export async function startScrapeQueue(): Promise<void> {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

  try {
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    await connection.ping();

    scrapeQueue = new Queue<ScrapeJobData>(SCRAPE_QUEUE_NAME, { connection });
    scrapeWorker = new Worker<ScrapeJobData>(
      SCRAPE_QUEUE_NAME,
      async (job: Job<ScrapeJobData>) => {
        await processScrapeJob(job.data);
      },
      {
        connection,
        limiter: { max: 10, duration: 60_000 },
      }
    );

    scrapeWorker.on('failed', (job, err) => {
      if (job?.data?.jobId) {
        setJobStatus(job.data.jobId, {
          status: 'failed',
          message: err.message,
        });
      }
    });

    console.log('[Lootly BullMQ] Bio scrape queue connected:', redisUrl);
  } catch (err) {
    console.warn(
      '[Lootly BullMQ] Redis unavailable — scrape jobs run inline. Set REDIS_URL for production queue.',
      err instanceof Error ? err.message : err
    );
  }
}

export async function shutdownScrapeQueue(): Promise<void> {
  await scrapeWorker?.close();
  await scrapeQueue?.close();
}
