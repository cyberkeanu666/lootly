import type { Locale } from './types';

export type DocsTab =
  | 'overview'
  | 'howto'
  | 'architecture'
  | 'features'
  | 'math'
  | 'api'
  | 'env';

export type DocsContent = {
  title: string;
  subtitle: string;
  copyMd: string;
  copied: string;
  tabs: Record<DocsTab, string>;
  sections: Record<
    DocsTab,
    { title: string; blocks: { heading?: string; body?: string; code?: string; list?: string[] }[] }
  >;
  markdownExport: string;
};

const markdownEn = `# Lootly — Technical Documentation (2026)

## Stack
- Frontend: React 19 + Vite 6 + Tailwind 4
- Backend: Express + TypeScript (tsx)
- Storage: Firestore (primary when configured) + local_db.json mirror + .lootly_secrets/
- Queue: BullMQ + Redis (bio scrape jobs)
- Scraper: Puppeteer + RapidAPI fallback
- Crypto: SHA-256 provably fair draw (32-byte seeds)

## Quick start
\`\`\`bash
npm install
cp .env.example .env
redis-server          # optional but recommended
npm run dev           # http://localhost:3000
\`\`\`

## Routes
| Route | Purpose |
|-------|---------|
| / | Landing + creator register/login |
| /dashboard | Host campaign management |
| /giveaway/:slug | Public entry + bio verification |
| /giveaway/:slug/draw | Live provably fair draw |
| /giveaway/:slug/archive | Proof archive + sandbox calculator |
| /embed/:slug | OBS widget |
| /docs | This documentation |

See in-app /docs for full API and configuration reference.
`;

const markdownSr = `# Lootly — Tehnička dokumentacija (2026)

## Stack
- Frontend: React 19 + Vite 6 + Tailwind 4
- Backend: Express + TypeScript (tsx)
- Skladište: Firestore (primarno) + local_db.json mirror + .lootly_secrets/
- Red: BullMQ + Redis (bio scrape poslovi)
- Scraper: Puppeteer + RapidAPI rezerva
- Kripto: SHA-256 provably fair draw (32-bajtna semena)

## Brzi start
\`\`\`bash
npm install
cp .env.example .env
redis-server          # opciono ali preporučeno
npm run dev           # http://localhost:3000
\`\`\`

## Rute
| Ruta | Svrha |
|------|-------|
| / | Početna + registracija/prijava kreatora |
| /dashboard | Upravljanje kampanjama |
| /giveaway/:slug | Javna prijava + bio verifikacija |
| /giveaway/:slug/draw | Uživo izvlačenje |
| /giveaway/:slug/archive | Arhiva dokaza |
| /embed/:slug | OBS widget |
| /docs | Ova dokumentacija |
`;

const en: DocsContent = {
  title: 'Lootly System Documentation',
  subtitle: 'What is implemented, how it works, and how to run the project locally.',
  copyMd: 'Copy Markdown',
  copied: 'Copied!',
  tabs: {
    overview: 'Overview',
    howto: 'How to use',
    architecture: 'Architecture',
    features: 'What works',
    math: 'Provably Fair',
    api: 'API',
    env: 'Environment',
  },
  markdownExport: markdownEn,
  sections: {
    overview: {
      title: 'Project overview',
      blocks: [
        {
          body: 'Lootly is a provably fair giveaway platform. Hosts create campaigns, participants verify Instagram bio codes, and winners are chosen with deterministic SHA-256 math. The server runs as a single process: Express API + Vite dev middleware on port 3000.',
        },
        {
          heading: 'Recent implementation (refactor)',
          list: [
            'Firestore-first persistence with local JSON mirror (local_db.json)',
            'Campaign secrets in .lootly_secrets/ and Firestore giveaway_secrets',
            'BullMQ bio verification queue (Puppeteer + RapidAPI)',
            '32-byte cryptographic seeds + hash verification on draw',
            'Creator register/login with scrypt password hashes',
            'Per-giveaway IP rate limits (not global demo pollution)',
            'Instagram username lock per campaign (pending + verified rules)',
            'EN / SR language switcher (header)',
          ],
        },
        {
          heading: 'Patch — May 2026 (UX & creator tools)',
          list: [
            'LootlyUI toasts + confirm modals (no browser alert/confirm)',
            'Header Creator Log in opens register/login modal instantly',
            'Host notification bell (campaign published, draw in ~1h, overdue draw)',
            'Live Draw campaign picker when multiple active giveaways exist',
            'Proof Archive uses real completed campaign data (not demo slug)',
            'How It Works guide: separate Creator vs Participant detailed paths',
            'Signup always Free plan; Pro upgrade shows “coming soon” toast',
            'Prize image file upload (POST /api/upload/prize-image → /uploads/)',
            'Bulk Instagram profile paste (newline/comma separated)',
            'Custom draw countdown hours on campaign create form',
            'Campaign page shows registered participant count (not fake viewers)',
            'Self-Verification Sandbox UI errors + server validation for empty roster',
            'Expanded EN/SR i18n across landing, giveaway, draw, archive, dashboard',
          ],
        },
      ],
    },
    howto: {
      title: 'How to use — step by step',
      blocks: [
        {
          heading: '1. Start the project',
          body: 'Install dependencies, copy .env.example to .env, start Redis (recommended), then npm run dev. Open http://localhost:3000.',
        },
        {
          heading: '2. Creator: register or log in',
          body: 'On the home page click Launch / Access Dashboard. Use the Register tab (email + password min 6 chars + display name). Existing accounts use the Log in tab. Session is stored in localStorage as lootly_host.',
        },
        {
          heading: '3. Create a campaign',
          body: 'Go to Creator Dashboard → New Sweepstakes. Fill title, prize, URL slug (auto from title), optional image URL, Instagram profiles to follow, draw countdown, winners count. Publish. Your link is /giveaway/your-slug.',
        },
        {
          heading: '4. Participant: join',
          body: 'Open the campaign link, enter Instagram username (and optional email). You receive a code like LOOTLY-1234-XXXX. Paste it in your public Instagram bio, click Verify Me. The server enqueues a BullMQ scrape job; the UI polls until complete.',
        },
        {
          heading: '5. Host: run the draw',
          body: 'Open /giveaway/your-slug/draw. You need at least one verified participant. Click to start draw — the server reveals the secret seed, verifies SHA256(seed) === published seedHash, and picks winner(s) deterministically.',
        },
        {
          heading: '6. Verify fairness',
          body: 'After draw, open /giveaway/your-slug/archive. Compare published hash, revealed seed, participant list. Use the sandbox calculator to reproduce the winner index independently.',
        },
        {
          heading: 'Dev tips',
          list: [
            'SCRAPER_SANDBOX=true — bio verification succeeds without real Instagram scrape',
            'DISABLE_IP_RATE_LIMIT=true — disables IP username cap in local dev',
            'Test on YOUR campaign slug, not only demo rtx5080-unleashed',
            'Free plan: max 1 active campaign, 500 participants if watermark on',
          ],
        },
      ],
    },
    architecture: {
      title: 'Architecture',
      blocks: [
        {
          body: 'Monolithic dev server (server.ts) delegates to modules under server/:',
          code: `server/
  auth/password.ts       # scrypt hash for hosts
  crypto/provablyFair.ts # seeds, draw index, sandbox math
  db/repository.ts     # read/write + Firestore mirror
  db/firestoreStore.ts   # Firebase Admin
  db/localStore.ts       # local_db.json + .lootly_secrets/
  db/seedResolver.ts     # resolve/repair campaign seeds
  queue/scrapeQueue.ts   # BullMQ worker + job status
  scraper/instagramBio.ts # Puppeteer → RapidAPI fallback
src/
  i18n/                  # EN + SR translations
  components/            # React pages`,
        },
        {
          heading: 'Data collections (Firestore / JSON)',
          list: [
            'users — host accounts',
            'giveaways — campaigns (seedHash public, seed null until draw)',
            'giveaway_secrets — private seeds (server only)',
            'participants — entries, tickets, verification state',
            'verification_log — scrape/audit logs',
            'referrals — referral bonus tracking',
          ],
        },
        {
          heading: 'Persistence flow',
          body: 'Writes go to local_db.json immediately, then batch-mirror to Firestore when firebase-applet-config.json or FIREBASE_SERVICE_ACCOUNT_PATH is set. On boot, repairMissingGiveawaySecrets() fixes campaigns with missing secrets.',
        },
      ],
    },
    features: {
      title: 'What works (real vs dev modes)',
      blocks: [
        {
          heading: 'Fully implemented',
          list: [
            'Campaign CRUD with slug, seedHash at creation, freemium limits',
            'Participant join + verification code (30 min expiry, 3 attempts)',
            'BullMQ async bio scrape with job status polling',
            'Provably fair multi-winner draw with ticket weights + referrals',
            'Archive page + cryptography sandbox API',
            'Host register/login with password',
            'Referral URL ?ref=username',
            'Embed widget + live participant polling (5s)',
            'i18n: English and Serbian',
          ],
        },
        {
          heading: 'Dev / sandbox modes',
          list: [
            'SCRAPER_SANDBOX=true — skips real Puppeteer, auto-passes bio check',
            'DISABLE_IP_RATE_LIMIT=true — no per-IP username cap',
            'Without Redis — scrape jobs run inline (still works)',
          ],
        },
        {
          heading: 'Production requirements',
          list: [
            'Redis for BullMQ (10 jobs/min limiter)',
            'SCRAPER_SANDBOX=false + RAPIDAPI_KEY for real Instagram bios',
            'Firebase service account for cloud persistence',
          ],
        },
      ],
    },
    math: {
      title: 'Provably Fair mathematics',
      blocks: [
        {
          body: 'When a campaign is created, the server generates a 32-byte random seed and stores it privately. Only seedHash = SHA256(seed) is shown publicly.',
        },
        {
          heading: 'Winner selection (weighted tickets)',
          code: `sortedUsernames = verified users sorted A-Z
ticketPool = expand by ticketCount (referral bonuses)
drawHash = SHA256(seed + ticketPool.join(','))
winnerIndex = BigInt(drawHash) % ticketPool.length
// Remove winner from pool; repeat for numWinners`,
        },
        {
          body: 'On draw day the seed is revealed. Anyone can verify SHA256(revealedSeed) === seedHash published at campaign start. Use POST /api/giveaway/cryptography-sandbox to reproduce indices.',
        },
      ],
    },
    api: {
      title: 'REST API reference',
      blocks: [
        {
          list: [
            'GET /api/health — status, counts, firestore/queue mode',
            'POST /api/hosts/register — { email, password, username, plan }',
            'POST /api/hosts/login — { email, password }',
            'POST /api/hosts/upgrade — { hostId }',
            'GET /api/giveaways — list (?hostId=)',
            'POST /api/giveaway/create — campaign + auto slug/seed',
            'POST /api/participants/join-request — start entry',
            'POST /api/participants/verify-bio — returns { jobId }',
            'GET /api/participants/verify-status/:jobId — poll scrape job',
            'POST /api/giveaway/draw-start/:id — run draw',
            'POST /api/giveaway/cryptography-sandbox — verify math',
            'GET /api/verification/logs?giveawayId=',
          ],
        },
      ],
    },
    env: {
      title: 'Environment variables',
      blocks: [
        {
          code: `PORT=3000
SCRAPER_SANDBOX=true          # dev: skip real Instagram scrape
DISABLE_IP_RATE_LIMIT=true    # dev: disable IP username cap
REDIS_URL=redis://127.0.0.1:6379
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
RAPIDAPI_KEY=
RAPIDAPI_INSTAGRAM_HOST=instagram-scraper-api2.p.rapidapi.com
INSTAGRAM_CLIENT_ID=            # optional Meta API
MAX_IP_USERNAMES_PER_GIVEAWAY_PER_DAY=3`,
        },
      ],
    },
  },
};

const sr: DocsContent = {
  title: 'Lootly — sistemska dokumentacija',
  subtitle: 'Šta je implementirano, kako radi i kako pokrenuti projekat lokalno.',
  copyMd: 'Kopiraj Markdown',
  copied: 'Kopirano!',
  tabs: {
    overview: 'Pregled',
    howto: 'Kako koristiti',
    architecture: 'Arhitektura',
    features: 'Šta radi',
    math: 'Provably Fair',
    api: 'API',
    env: 'Podešavanja',
  },
  markdownExport: markdownSr,
  sections: {
    overview: {
      title: 'Pregled projekta',
      blocks: [
        {
          body: 'Lootly je platforma za provably fair nagradne igre. Kreatori prave kampanje, učesnici verifikuju Instagram bio kod, a pobednici se biraju determinističkim SHA-256 algoritmom. Server je jedan proces: Express API + Vite middleware na portu 3000.',
        },
        {
          heading: 'Poslednja implementacija (refaktor)',
          list: [
            'Firestore kao primarno skladište + local_db.json mirror',
            'Tajna semena u .lootly_secrets/ i Firestore giveaway_secrets',
            'BullMQ red za bio verifikaciju (Puppeteer + RapidAPI)',
            '32-bajtna semena + provera hash-a pri draw-u',
            'Registracija/prijava kreatora sa scrypt lozinkom',
            'IP limit po kampanji (ne globalno od demo podataka)',
            'Zaključavanje Instagram username-a po kampanji',
            'Prekidač jezika EN / SR u headeru',
          ],
        },
        {
          heading: 'Patch — maj 2026 (UX i alati za kreatore)',
          list: [
            'LootlyUI toast + confirm modali (bez browser alert)',
            'Creator Log in u headeru odmah otvara login/registraciju',
            'Zvonce obaveštenja (nova kampanja, draw za ~1h, isteklo odbrojavanje)',
            'Izbor kampanje za Live Draw kad ih ima više',
            'Arhiva dokaza sa pravim podacima završene kampanje',
            'Vodič Kako radi: posebno za kreatore i učesnike (detaljno)',
            'Registracija uvek Free; Pro upgrade “uskoro” toast',
            'Upload slike nagrade (POST /api/upload/prize-image)',
            'Bulk paste Instagram profila',
            'Prilagođeno odbrojavanje do izvlačenja (sati)',
            'Broj prijavljenih na stranici kampanje',
            'Sandbox validacija i UI greške',
            'Prošireni EN/SR prevodi',
          ],
        },
      ],
    },
    howto: {
      title: 'Kako koristiti — korak po korak',
      blocks: [
        {
          heading: '1. Pokretanje projekta',
          body: 'npm install, kopiraj .env.example u .env, pokreni Redis (preporučeno), zatim npm run dev. Otvori http://localhost:3000.',
        },
        {
          heading: '2. Kreator: registracija ili prijava',
          body: 'Na početnoj stranici otvori modal za pristup. Tab Registracija (email + lozinka min 6 karaktera + ime). Tab Prijava za postojeće naloge. Sesija se čuva u localStorage (lootly_host).',
        },
        {
          heading: '3. Kreiranje kampanje',
          body: 'Kontrolna tabla → Nova nagradna igra. Popuni naslov, nagradu, URL slug, opciono sliku, Instagram profile, countdown, broj pobednika. Objavi. Link: /giveaway/tvoj-slug.',
        },
        {
          heading: '4. Učesnik: prijava',
          body: 'Otvori link kampanje, unesi Instagram username. Dobijaš kod (npr. LOOTLY-1234-XXXX). Stavi ga u javni bio, klikni Verify Me. Server stavlja posao u BullMQ red; UI polluje status.',
        },
        {
          heading: '5. Kreator: izvlačenje',
          body: 'Otvori /giveaway/tvoj-slug/draw. Potreban je bar jedan verifikovan učesnik. Pokreni draw — server otkriva seed i bira pobednika deterministički.',
        },
        {
          heading: '6. Provera fer igre',
          body: 'Posle draw-a otvori /giveaway/tvoj-slug/archive. Uporedi hash, seed i listu učesnika. Sandbox kalkulator nezavisno proverava matematiku.',
        },
        {
          heading: 'Saveti za dev',
          list: [
            'SCRAPER_SANDBOX=true — verifikacija prolazi bez pravog scrape-a',
            'DISABLE_IP_RATE_LIMIT=true — isključuje IP limit u dev-u',
            'Testiraj na SVOJOJ kampanji, ne samo demo rtx5080-unleashed',
            'Free plan: max 1 aktivna kampanja',
          ],
        },
      ],
    },
    architecture: {
      title: 'Arhitektura',
      blocks: [
        {
          body: 'Monolitni dev server (server.ts) koristi module u server/:',
          code: `server/
  auth/password.ts       # scrypt hash za hostove
  crypto/provablyFair.ts # semena, draw, sandbox
  db/repository.ts       # čitanje/pisanje + Firestore mirror
  db/firestoreStore.ts   # Firebase Admin
  db/localStore.ts       # local_db.json + .lootly_secrets/
  db/seedResolver.ts     # resolve/repair semena
  queue/scrapeQueue.ts   # BullMQ worker
  scraper/instagramBio.ts # Puppeteer → RapidAPI
src/i18n/ + components/  # frontend`,
        },
        {
          heading: 'Kolekcije podataka',
          list: [
            'users — nalozi kreatora',
            'giveaways — kampanje',
            'giveaway_secrets — privatna semena',
            'participants — prijave i tiketi',
            'verification_log — logovi verifikacije',
            'referrals — referral bonusi',
          ],
        },
        {
          heading: 'Tok perzistencije',
          body: 'Pisanje ide u local_db.json, zatim mirror u Firestore ako je Firebase podešen. Pri startu server popravlja kampanje bez sačuvanog secreta.',
        },
      ],
    },
    features: {
      title: 'Šta radi (pravo vs dev režim)',
      blocks: [
        {
          heading: 'Potpuno implementirano',
          list: [
            'CRUD kampanja sa slug-om i seedHash pri kreiranju',
            'Prijava učesnika + verifikacioni kod',
            'BullMQ async bio scrape + polling statusa',
            'Provably fair draw sa tiketima i referral bonusima',
            'Arhiva + sandbox kalkulator',
            'Registracija/prijava kreatora',
            'Referral ?ref=username',
            'Embed widget',
            'Jezici EN i SR',
          ],
        },
        {
          heading: 'Dev / sandbox',
          list: [
            'SCRAPER_SANDBOX=true — automatska bio verifikacija',
            'DISABLE_IP_RATE_LIMIT=true — bez IP limita',
            'Bez Redisa — scrape inline',
          ],
        },
        {
          heading: 'Produkcija',
          list: [
            'Redis + BullMQ',
            'SCRAPER_SANDBOX=false + RAPIDAPI_KEY',
            'Firebase service account',
          ],
        },
      ],
    },
    math: {
      title: 'Provably Fair matematika',
      blocks: [
        {
          body: 'Pri kreiranju kampanje generiše se 32-bajtno slučajno seme. Javno se prikazuje samo seedHash = SHA256(seed).',
        },
        {
          heading: 'Izbor pobednika (težinski tiketi)',
          code: `ticketPool = proširena lista username-a po ticketCount
drawHash = SHA256(seed + ticketPool.join(','))
index = BigInt(drawHash) % dužina_pool-a`,
        },
        {
          body: 'Na dan draw-a seed se objavljuje. Svako može proveriti SHA256(seed) === seedHash. API: POST /api/giveaway/cryptography-sandbox.',
        },
      ],
    },
    api: {
      title: 'REST API',
      blocks: [
        {
          list: [
            'GET /api/health',
            'POST /api/hosts/register | /api/hosts/login',
            'POST /api/giveaway/create',
            'POST /api/participants/join-request',
            'POST /api/participants/verify-bio → jobId',
            'GET /api/participants/verify-status/:jobId',
            'POST /api/giveaway/draw-start/:id',
            'POST /api/giveaway/cryptography-sandbox',
          ],
        },
      ],
    },
    env: {
      title: 'Environment varijable',
      blocks: [
        {
          code: `PORT=3000
SCRAPER_SANDBOX=true
DISABLE_IP_RATE_LIMIT=true
REDIS_URL=redis://127.0.0.1:6379
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_PATH=
RAPIDAPI_KEY=`,
        },
      ],
    },
  },
};

export function getDocsContent(locale: Locale): DocsContent {
  return locale === 'sr' ? sr : en;
}
