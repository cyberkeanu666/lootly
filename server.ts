import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import fs from 'fs';

import {
  readDatabase,
  writeDatabase,
  createGiveawayWithSeed,
  generateVerificationCode,
  atomicParticipantLock,
} from './server/db/repository.js';
import { resolveCampaignSeed, repairMissingGiveawaySecrets } from './server/db/seedResolver.js';
import { initFirestore, isFirestoreActive } from './server/db/firestoreStore.js';
import { hashPassword, verifyPassword } from './server/auth/password.js';
import { requireAuth, optionalAuth, type AuthRequest } from './server/auth/middleware.js';
import jwt from 'jsonwebtoken';
import {
  sandboxVerifyWinner,
  computeDrawHash,
  buildTicketPool,
  pickWinnerIndex,
  verifySeedAgainstHash,
} from './server/crypto/provablyFair.js';
import {
  enqueueBioScrapeJob,
  getScrapeJobStatus,
  startScrapeQueue,
  shutdownScrapeQueue,
  isBullMqActive,
} from './server/queue/scrapeQueue.js';
import { scrapeFollowingList } from './server/scraper/instagramBio.js';
import { sendWinnerEmail } from './server/services/email.js';
import type { HostUser } from './server/db/types.js';

function sanitizeHost(host: HostUser) {
  const { passwordHash: _, ...safe } = host;
  return safe;
}

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

function signHostToken(host: HostUser): string {
  return jwt.sign({ hostId: host.id, email: host.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function auditWinnerFollows(
  username: string,
  requiredProfiles: string[]
): Promise<{ passed: boolean; missingProfiles: string[] }> {
  if (requiredProfiles.length === 0) return { passed: true, missingProfiles: [] };
  if (process.env.SCRAPER_SANDBOX === 'true') return { passed: true, missingProfiles: [] };

  const result = await scrapeFollowingList(username);

  if (!result.success) {
    console.error(`[Draw Audit] Scrape failed for @${username}:`, result.error);
    return { passed: false, missingProfiles: requiredProfiles };
  }

  if (result.isPrivate) {
    console.warn(`[Draw Audit] @${username} has private profile — cannot verify follows`);
    return { passed: false, missingProfiles: requiredProfiles };
  }

  const followingSet = new Set(result.following.map((u) => u.toLowerCase()));
  const missingProfiles = requiredProfiles.filter((p) => !followingSet.has(p.toLowerCase()));

  return { passed: missingProfiles.length === 0, missingProfiles };
}

async function startServer() {
  initFirestore();
  try {
    await startScrapeQueue();
  } catch (e) {
    console.warn('[Server] Queue init failed, continuing:', e);
  }
  await repairMissingGiveawaySecrets();

  let io!: SocketServer;

  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production',
    message: { error: 'Too many requests — slow down.' },
  });

  const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: { error: 'Too many auth attempts. Try again in 10 minutes.' },
    skip: () => process.env.NODE_ENV !== 'production',
  });

  app.use('/api', apiLimiter);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '3mb' }));

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));

  app.post('/api/upload/prize-image', (req, res) => {
    const { imageBase64, mimeType } = req.body as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided.' });
    }
    const mime = String(mimeType || 'image/jpeg');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(mime)) {
      return res.status(400).json({ error: 'Unsupported image type. Use JPG, PNG, or WebP.' });
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(imageBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Invalid image encoding.' });
    }
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 2 MB).' });
    }
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[mime] || 'jpg';
    const filename = `prize_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);
    return res.json({ url: `/uploads/${filename}` });
  });

  const isSecretsConfigured = !!(
    process.env.INSTAGRAM_CLIENT_ID || process.env.HOST_INSTAGRAM_ACCESS_TOKEN
  );
  console.log(
    `[Lootly API] Environment: ${isSecretsConfigured ? 'Live credentials' : 'Bio-code mode'} | Firestore: ${isFirestoreActive() ? 'active' : 'local disk mirror'}`
  );

  app.get('/api/health', async (req, res) => {
    const dbData = await readDatabase();
    res.json({
      status: 'ok',
      hosts: dbData.hosts.length,
      giveaways: dbData.giveaways.length,
      participants: dbData.participants.length,
      firestore: isFirestoreActive(),
      queue: isBullMqActive() ? 'bullmq' : 'inline',
      time: new Date().toISOString(),
      secretsConnected: isSecretsConfigured,
    });
  });

  app.get('/api/hosts', async (req, res) => {
    const dbData = await readDatabase();
    res.json(dbData.hosts);
  });

  app.post('/api/hosts/register', authLimiter, async (req, res) => {
    const dbData = await readDatabase();
    const { email, username, password } = req.body;
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (dbData.hosts.some((h) => h.email === normalizedEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const host: HostUser = {
      id: 'host_' + Date.now().toString(36),
      email: normalizedEmail,
      username: String(username || normalizedEmail.split('@')[0]).trim(),
      plan: 'free',
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(String(password)),
    };
    dbData.hosts.push(host);
    await writeDatabase(dbData);
    const token = signHostToken(host);
    return res.status(201).json({ host: sanitizeHost(host), token });
  });

  app.post('/api/hosts/login', authLimiter, async (req, res) => {
    const dbData = await readDatabase();
    const { email, password } = req.body;
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const host = dbData.hosts.find((h) => h.email === normalizedEmail);
    if (!host) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!host.passwordHash) {
      host.passwordHash = hashPassword(String(password));
      await writeDatabase(dbData);
      const token = signHostToken(host);
      return res.json({ host: sanitizeHost(host), token });
    }

    if (!verifyPassword(String(password), host.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signHostToken(host);
    return res.json({ host: sanitizeHost(host), token });
  });

  /** @deprecated Use /api/hosts/register or /api/hosts/login */
  app.post('/api/hosts/create-or-login', async (req, res) => {
    const { email, password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password required. Use register or login endpoints.' });
    }
    const dbData = await readDatabase();
    const normalizedEmail = String(email || '')
      .trim()
      .toLowerCase();
    const existing = dbData.hosts.find((h) => h.email === normalizedEmail);
    if (existing) {
      if (!existing.passwordHash) {
        existing.passwordHash = hashPassword(String(password));
        await writeDatabase(dbData);
        return res.json(sanitizeHost(existing));
      }
      if (verifyPassword(String(password), existing.passwordHash)) {
        return res.json(sanitizeHost(existing));
      }
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    return res.status(404).json({ error: 'Account not found. Please register first.' });
  });

  app.post('/api/hosts/upgrade', requireAuth, async (req: AuthRequest, res) => {
    const dbData = await readDatabase();
    const { hostId } = req.body;
    if (hostId && hostId !== req.hostId) {
      return res.status(403).json({ error: 'Forbidden: cannot upgrade another account.' });
    }
    const hostIdx = dbData.hosts.findIndex((h) => h.id === req.hostId);
    if (hostIdx !== -1) {
      dbData.hosts[hostIdx].plan = 'pro';
      await writeDatabase(dbData);
      return res.json(sanitizeHost(dbData.hosts[hostIdx]));
    }
    res.status(404).json({ error: 'Host user not found.' });
  });

  app.get('/api/giveaways', async (req, res) => {
    const dbData = await readDatabase();
    const { hostId } = req.query;
    if (hostId) {
      return res.json(dbData.giveaways.filter((g) => g.hostId === hostId));
    }
    res.json(dbData.giveaways);
  });

  app.get('/api/giveaway/by-slug/:slug', async (req, res) => {
    const dbData = await readDatabase();
    const giveaway = dbData.giveaways.find((g) => g.slug === req.params.slug);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway campaign not found' });
    res.json(giveaway);
  });

  app.get('/api/giveaway/:slug/archive', async (req, res) => {
    const dbData = await readDatabase();
    const giveaway = dbData.giveaways.find((g) => g.slug === req.params.slug);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    if (giveaway.status !== 'completed') {
      return res.status(404).json({ error: 'Draw has not taken place yet.' });
    }

    const participants = dbData.participants.filter(
      (p) => p.giveawayId === giveaway.id && p.verifiedAt
    );
    const logs = dbData.logs.filter((l) => l.giveawayId === giveaway.id);

    const seedVerified = giveaway.seed
      ? verifySeedAgainstHash(giveaway.seed, giveaway.seedHash)
      : false;

    const giveawayWithRounds = giveaway as typeof giveaway & {
      rounds?: { winner: string; drawHash: string; winnerIndex: number }[];
    };

    res.json({
      title: giveaway.title,
      prize: giveaway.prize,
      slug: giveaway.slug,
      drawDate: giveaway.drawDate,
      seedHash: giveaway.seedHash,
      revealedSeed: giveaway.seed,
      seedVerified,
      winners: giveaway.winners || [],
      disqualifiedList: giveaway.disqualifiedList || [],
      rounds: giveawayWithRounds.rounds || [],
      sortedParticipants: participants
        .map((p) => ({
          username: p.instagramUsername,
          ticketNumber: p.ticketCount,
          verifiedAt: p.verifiedAt,
        }))
        .sort((a, b) => a.username.localeCompare(b.username)),
      verificationLog: logs,
      totalParticipants: participants.length,
    });
  });

  app.post('/api/giveaway/create', requireAuth, async (req: AuthRequest, res) => {
    const dbData = await readDatabase();
    const {
      hostId,
      title,
      prize,
      prizeDescription,
      prizeImageURL,
      slug,
      requiredProfiles,
      drawDate,
      maxParticipants,
      numWinners,
      mode,
      referralBonusTickets,
    } = req.body;

    if (!hostId || !title || !prize) {
      return res.status(400).json({ error: 'Missing mandatory giveaway variables (title and prize required).' });
    }

    if (hostId !== req.hostId) {
      return res.status(403).json({ error: 'Forbidden: cannot create giveaway for another host.' });
    }

    const slugify = (text: string) => {
      const base = String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return base || `giveaway-${Date.now().toString(36).slice(-6)}`;
    };
    const resolvedSlug = slug
      ? String(slug).toLowerCase().replace(/[^a-z0-9-_]/g, '')
      : slugify(title);

    const host = dbData.hosts.find((h) => h.id === hostId);
    if (!host) return res.status(400).json({ error: 'Host account verification failed.' });

    if (host.plan === 'free') {
      const activeCount = dbData.giveaways.filter(
        (g) => g.hostId === hostId && g.status !== 'completed'
      ).length;
      if (activeCount >= 3) {
        return res.status(403).json({
          error:
            'Freemium Limit Exceeded: Free users are capped at 3 active giveaways. Upgrade to Lootly Pro for unlimited campaigns!',
        });
      }
    }

    if (dbData.giveaways.some((g) => g.slug.toLowerCase() === resolvedSlug.toLowerCase())) {
      return res.status(400).json({ error: 'Slug unique URL is already taken!' });
    }

    const { giveaway: newGiveaway } = await createGiveawayWithSeed({
      hostId,
      title,
      prize,
      prizeDescription,
      prizeImageURL:
        prizeImageURL ||
        'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80',
      slug: resolvedSlug,
      requiredProfiles: Array.isArray(requiredProfiles)
        ? requiredProfiles.map((p: string) => p.replace('@', '').trim().toLowerCase())
        : [],
      drawDate: drawDate || new Date(Date.now() + 86400000 * 3).toISOString(),
      status: 'active',
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      numWinners: numWinners ? Number(numWinners) : 1,
      mode: mode || 'verified',
      referralBonusTickets: referralBonusTickets ? Number(referralBonusTickets) : 1,
      watermark: host.plan === 'free',
      trafficSources: { direct: 1, referral: 0, social: 1, search: 0 },
      peakHours: { '12:00': 0 },
      winners: [],
      disqualifiedList: [],
    });

    res.json(newGiveaway);
  });

  app.post('/api/giveaway/edit/:id', requireAuth, async (req: AuthRequest, res) => {
    const dbData = await readDatabase();
    const { id } = req.params;
    const { title, prize, prizeDescription, prizeImageURL, maxParticipants, requiredProfiles, numWinners } =
      req.body;
    const idx = dbData.giveaways.findIndex((g) => g.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Giveaway not found' });

    const g = dbData.giveaways[idx];
    if (g.hostId !== req.hostId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this giveaway.' });
    }
    g.title = title || g.title;
    g.prize = prize || g.prize;
    g.prizeDescription = prizeDescription || g.prizeDescription;
    g.prizeImageURL = prizeImageURL || g.prizeImageURL;
    g.maxParticipants = maxParticipants !== undefined ? maxParticipants : g.maxParticipants;
    g.numWinners = numWinners ? Number(numWinners) : g.numWinners;
    if (requiredProfiles) {
      g.requiredProfiles = requiredProfiles.map((p: string) =>
        p.replace('@', '').trim().toLowerCase()
      );
    }
    await writeDatabase(dbData);
    res.json(g);
  });

  app.delete('/api/giveaway/:id', requireAuth, async (req: AuthRequest, res) => {
    const dbData = await readDatabase();
    const { id } = req.params;
    const giveaway = dbData.giveaways.find((g) => g.id === id);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway not found' });
    if (giveaway.hostId !== req.hostId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this giveaway.' });
    }
    dbData.giveaways = dbData.giveaways.filter((g) => g.id !== id);
    dbData.participants = dbData.participants.filter((p) => p.giveawayId !== id);
    await writeDatabase(dbData);
    res.json({ success: true });
  });

  app.get('/api/participants/by-giveaway/:giveawayId', async (req, res) => {
    const dbData = await readDatabase();
    res.json(dbData.participants.filter((p) => p.giveawayId === req.params.giveawayId));
  });

  app.get('/api/participants/for-host/:hostId', async (req, res) => {
    const dbData = await readDatabase();
    const { hostId } = req.params;
    const giveawayIds = new Set(
      dbData.giveaways.filter((g) => g.hostId === hostId).map((g) => g.id)
    );
    res.json(dbData.participants.filter((p) => giveawayIds.has(p.giveawayId)));
  });

  app.post('/api/participants/join-request', optionalAuth, async (req: AuthRequest, res) => {
    let dbData = await readDatabase();
    const { instagramUsername, giveawayId, referredBy, email } = req.body;
    const clientIp = req.ip || '127.0.0.1';

    if (!instagramUsername || !giveawayId) {
      return res.status(400).json({ error: 'Missing username or giveaway specifications.' });
    }

    const giveaway = dbData.giveaways.find((g) => g.id === giveawayId);
    if (!giveaway) return res.status(404).json({ error: 'Giveaway does not exist.' });

    // Prevent giveaway host from joining their own giveaway
    if (req.hostId && req.hostId === giveaway.hostId) {
      return res.status(403).json({ error: 'Giveaway hosts cannot participate in their own campaigns.' });
    }

    const handle = instagramUsername.replace('@', '').trim().toLowerCase();
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;

    const existingForUsername = dbData.participants.find(
      (p) => p.giveawayId === giveawayId && p.instagramUsername === handle
    );

    if (existingForUsername?.verifiedAt) {
      return res.status(400).json({
        error: `Instagram user @${handle} is already verified in this giveaway.`,
      });
    }

    if (
      existingForUsername &&
      !existingForUsername.verifiedAt &&
      normalizedEmail &&
      existingForUsername.email &&
      existingForUsername.email !== normalizedEmail
    ) {
      return res.status(409).json({
        error: `@${handle} already has a pending verification under another email. Wait for expiry or use the same email.`,
      });
    }

    if (
      existingForUsername &&
      !existingForUsername.verifiedAt &&
      !existingForUsername.email &&
      normalizedEmail &&
      existingForUsername.ipAddress !== clientIp
    ) {
      return res.status(409).json({
        error: `@${handle} already has a pending verification in progress.`,
      });
    }

    if (giveaway.maxParticipants) {
      const verifiedCount = dbData.participants.filter(
        (p) => p.giveawayId === giveawayId && p.verifiedAt
      ).length;
      if (verifiedCount >= giveaway.maxParticipants) {
        return res.status(403).json({ error: 'Campaign is full.' });
      }
    }

    if (giveaway.watermark) {
      const currentVerified = dbData.participants.filter(
        (p) => p.giveawayId === giveawayId && p.verifiedAt
      ).length;
      if (currentVerified >= 500) {
        return res.status(403).json({ error: 'Free tier participant cap reached.' });
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const ipLimitDisabled = process.env.DISABLE_IP_RATE_LIMIT === 'true';
    const maxPerIp = Number(process.env.MAX_IP_USERNAMES_PER_GIVEAWAY_PER_DAY) || 1;
    const ipEntriesTodayForGiveaway = dbData.participants.filter(
      (p) =>
        p.giveawayId === giveawayId &&
        p.ipAddress === clientIp &&
        p.joinedAt.startsWith(today)
    );
    const uniqueUsernamesForIp = new Set(
      ipEntriesTodayForGiveaway.map((p) => p.instagramUsername)
    );
    if (
      !ipLimitDisabled &&
      uniqueUsernamesForIp.size >= maxPerIp &&
      !uniqueUsernamesForIp.has(handle)
    ) {
      return res.status(429).json({
        error: `Rate limit: max ${maxPerIp} different Instagram usernames per IP per day for this giveaway.`,
      });
    }

    const verificationCodeNum = generateVerificationCode(giveawayId);

    let entry = existingForUsername && !existingForUsername.verifiedAt ? existingForUsername : undefined;
    if (entry) {
      entry.verificationCode = verificationCodeNum;
      entry.verificationExpiresAt = new Date(Date.now() + 1800000).toISOString();
      entry.verificationAttempts = 0;
      entry.referredBy = referredBy
        ? String(referredBy).replace('@', '').trim().toLowerCase()
        : null;
      entry.email = normalizedEmail || entry.email;
    } else {
      entry = {
        id: 'p_' + crypto.randomUUID().split('-')[0],
        giveawayId,
        instagramUsername: handle,
        verifiedAt: null,
        ticketCount: 1,
        referredBy: referredBy
          ? String(referredBy).replace('@', '').trim().toLowerCase()
          : null,
        verificationCode: verificationCodeNum,
        verificationExpiresAt: new Date(Date.now() + 1800000).toISOString(),
        verificationAttempts: 0,
        ipAddress: clientIp,
        email: normalizedEmail,
        joinedAt: new Date().toISOString(),
      };
      const lockResult = await atomicParticipantLock(giveawayId, handle, entry);
      if (!lockResult.success) {
        return res.status(400).json({ error: lockResult.error || 'Registration failed.' });
      }
      dbData = await readDatabase();
      const refreshedGiveaway = dbData.giveaways.find((g) => g.id === giveawayId);
      if (!refreshedGiveaway) {
        return res.status(404).json({ error: 'Giveaway does not exist.' });
      }
      Object.assign(giveaway, refreshedGiveaway);
    }

    if (referredBy) giveaway.trafficSources.referral++;
    else {
      const channels: ('direct' | 'social' | 'search')[] = ['direct', 'social', 'search'];
      giveaway.trafficSources[channels[Math.floor(Math.random() * channels.length)]]++;
    }
    const currentHour =
      new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit' }) + ':00';
    giveaway.peakHours[currentHour] = (giveaway.peakHours[currentHour] || 0) + 1;

    await writeDatabase(dbData);
    res.json({
      verificationCodeNum,
      expiresInMinutes: 30,
      participantId: entry.id,
    });
  });

  /** Enqueue BullMQ bio scrape (docs: async job, max 10/min via Redis limiter). */
  app.post('/api/participants/verify-bio', async (req, res) => {
    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ error: 'participantId required' });

    const dbData = await readDatabase();
    const participant = dbData.participants.find((p) => p.id === participantId);
    if (!participant) return res.status(404).json({ error: 'Registration record expired/missing.' });

    if (new Date() > new Date(participant.verificationExpiresAt)) {
      return res.status(400).json({ error: 'Verification code expired. Request a new code.' });
    }

    if (participant.verificationAttempts >= 3) {
      return res.status(400).json({ error: 'Max 3 verification attempts. Request a new code.' });
    }

    const jobId = 'scrape_' + crypto.randomUUID().split('-')[0];
    await enqueueBioScrapeJob({
      jobId,
      participantId,
      instagramUsername: participant.instagramUsername,
      verificationCode: participant.verificationCode,
    });

    res.status(202).json({ jobId, status: 'queued' });
  });

  app.post('/api/participants/refresh-code', async (req, res) => {
    const { participantId } = req.body;
    if (!participantId) return res.status(400).json({ error: 'participantId required' });

    const dbData = await readDatabase();
    const idx = dbData.participants.findIndex((p) => p.id === participantId);
    if (idx === -1) return res.status(404).json({ error: 'Participant not found.' });

    const participant = dbData.participants[idx];
    if (participant.verifiedAt) {
      return res.status(400).json({ error: 'Already verified — no need to refresh.' });
    }

    const newCode = generateVerificationCode(participant.giveawayId);
    dbData.participants[idx] = {
      ...participant,
      verificationCode: newCode,
      verificationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      verificationAttempts: 0,
    };
    await writeDatabase(dbData);

    res.json({ verificationCode: newCode, verificationCodeNum: newCode });
  });

  app.get('/api/participants/verify-status/:jobId', async (req, res) => {
    const status = getScrapeJobStatus(req.params.jobId);
    if (!status) return res.status(404).json({ error: 'Job not found' });

    if (
      status.status === 'completed' &&
      status.success &&
      status.participantId &&
      !status.participant
    ) {
      const dbData = await readDatabase();
      const participant = dbData.participants.find((p) => p.id === status.participantId);
      return res.json({ ...status, participant });
    }

    res.json(status);
  });

  app.post('/api/giveaway/draw-start/:id', requireAuth, async (req: AuthRequest, res) => {
    const dbData = await readDatabase();
    const { id } = req.params;
    const giveaway = dbData.giveaways.find((g) => g.id === id);

    if (!giveaway) return res.status(404).json({ error: 'Giveaway campaign not found' });
    if (giveaway.hostId !== req.hostId) {
      return res.status(403).json({ error: 'Forbidden: you do not own this giveaway.' });
    }

    const verifiedParticipants = dbData.participants.filter(
      (p) => p.giveawayId === id && p.verifiedAt !== null
    );
    if (verifiedParticipants.length === 0) {
      return res.status(400).json({ error: 'Zero verified participants.' });
    }

    giveaway.status = 'drawing';
    await writeDatabase(dbData);

    io.to(id).emit('draw:started', {
      totalParticipants: verifiedParticipants.length,
      giveawayTitle: giveaway.title,
    });

    const secretCampaignSeed = await resolveCampaignSeed(id, giveaway.seedHash);
    if (!secretCampaignSeed) {
      return res.status(500).json({
        error:
          'Campaign draw secret is missing or corrupted. Delete and recreate the giveaway, or restart the server to auto-repair seeds.',
      });
    }

    io.to(id).emit('draw:seed_revealed', {
      seed: secretCampaignSeed,
      seedHash: giveaway.seedHash,
      sortedPool: buildTicketPool(verifiedParticipants),
    });

    let drawingRoster = buildTicketPool(verifiedParticipants);
    const ticketPool = [...drawingRoster];
    const winnersChosen: string[] = [];
    const disqualifiedCandidates: { username: string; reason: string }[] = [];
    const rounds: { winner: string; drawHash: string; winnerIndex: number }[] = [];

    while (winnersChosen.length < giveaway.numWinners && drawingRoster.length > 0) {
      const winnerIndex = pickWinnerIndex(secretCampaignSeed, drawingRoster);
      const targetCandidateUsername = drawingRoster[winnerIndex];
      const drawHash = computeDrawHash(secretCampaignSeed, drawingRoster);
      rounds.push({ winner: targetCandidateUsername, drawHash, winnerIndex });

      io.to(id).emit('draw:winner_drawn', {
        username: targetCandidateUsername,
        drawHash,
        winnerIndex,
        roundNumber: winnersChosen.length + disqualifiedCandidates.length + 1,
      });
      io.to(id).emit('draw:verifying', { username: targetCandidateUsername });

      const audit = await auditWinnerFollows(
        targetCandidateUsername,
        giveaway.requiredProfiles
      );

      if (audit.passed) {
        winnersChosen.push(targetCandidateUsername);
        io.to(id).emit('draw:winner_verified', {
          username: targetCandidateUsername,
          passed: true,
          missingProfiles: [],
        });
        drawingRoster = drawingRoster.filter((u) => u !== targetCandidateUsername);
        dbData.logs.unshift({
          id: 'log_' + Date.now(),
          giveawayId: id,
          instagramUsername: targetCandidateUsername,
          checkedAt: new Date().toISOString(),
          result: 'passed',
          failedProfiles: [],
          message: `Winner @${targetCandidateUsername} passed follow audit.`,
        });
      } else {
        disqualifiedCandidates.push({
          username: targetCandidateUsername,
          reason: `Missing follow: @${audit.missingProfiles[0] || 'required'}`,
        });
        io.to(id).emit('draw:winner_verified', {
          username: targetCandidateUsername,
          passed: false,
          missingProfiles: audit.missingProfiles,
        });
        drawingRoster = drawingRoster.filter((u) => u !== targetCandidateUsername);
        dbData.logs.unshift({
          id: 'log_' + Date.now(),
          giveawayId: id,
          instagramUsername: targetCandidateUsername,
          checkedAt: new Date().toISOString(),
          result: 'disqualified',
          failedProfiles: audit.missingProfiles,
          message: `Disqualified @${targetCandidateUsername} — follow audit failed.`,
        });
      }
    }

    giveaway.status = 'completed';
    giveaway.seed = secretCampaignSeed;
    giveaway.winners = winnersChosen;
    giveaway.disqualifiedList = disqualifiedCandidates;
    await writeDatabase(dbData);

    for (const winnerUsername of winnersChosen) {
      const winnerParticipant = dbData.participants.find(
        (p) => p.giveawayId === id && p.instagramUsername === winnerUsername && p.email
      );
      if (winnerParticipant?.email) {
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        await sendWinnerEmail({
          to: winnerParticipant.email,
          winnerUsername,
          giveawayTitle: giveaway.title,
          prize: giveaway.prize,
          archiveUrl: `${baseUrl}/giveaway/${giveaway.slug}/archive`,
        });
      }
    }

    io.to(id).emit('draw:completed', {
      winners: winnersChosen,
      disqualifiedList: disqualifiedCandidates,
      revealedSeed: secretCampaignSeed,
    });

    res.json({
      winners: winnersChosen,
      disqualifiedList: disqualifiedCandidates,
      revealedSeed: secretCampaignSeed,
      seedHashVerified: true,
      deterministicHash: computeDrawHash(secretCampaignSeed, ticketPool),
      sortedTicketPoolLength: ticketPool.length,
      rounds,
    });
  });

  app.post('/api/giveaway/cryptography-sandbox', (req, res) => {
    const { seed, sortedParticipantCommaList } = req.body;
    if (!seed || !sortedParticipantCommaList) {
      return res.status(400).json({ error: 'Seed and participant list are required.' });
    }
    const result = sandboxVerifyWinner(seed, sortedParticipantCommaList);
    if (result.orderedList.length === 0) {
      return res.status(400).json({ error: 'No valid usernames in participant list.' });
    }
    if (!result.winnerUsername) {
      return res.status(400).json({ error: 'Could not resolve a winner from the participant list.' });
    }
    res.json(result);
  });

  app.get('/api/verification/logs', async (req, res) => {
    const dbData = await readDatabase();
    const { giveawayId } = req.query;
    if (giveawayId) {
      return res.json(dbData.logs.filter((l) => l.giveawayId === giveawayId));
    }
    res.json(dbData.logs);
  });

  app.get('/lootly-docs.html', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'lootly-docs.html'));
  });

  app.get('/documentation.html', (req, res) => {
    res.sendFile(path.resolve(process.cwd(), 'documentation.html'));
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    console.log('[Lootly Vite] Dev middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const template = await vite.transformIndexHtml(
          url,
          `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lootly - Provably Fair Giveaway Platform</title>
  </head>
  <body class="bg-[#040813] text-[#f1f5f9] antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
        );
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const httpServer = createServer(app);
  io = new SocketServer(httpServer, {
    cors: { origin: '*', credentials: true },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  io.on('connection', (socket) => {
    socket.on('join:giveaway', ({ giveawayId }: { giveawayId: string }) => {
      socket.join(giveawayId);
    });
  });

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lootly Server] Live on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    await shutdownScrapeQueue();
    server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[Fatal] Backend initiation crashed:', err);
  process.exit(1);
});
