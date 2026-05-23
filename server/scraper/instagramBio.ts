export interface ScrapeBioResult {
  success: boolean;
  bioText: string;
  codeFound: boolean;
  source: 'puppeteer' | 'rapidapi' | 'sandbox';
  error?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function scrapeWithPuppeteer(username: string): Promise<string> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await new Promise((r) => setTimeout(r, 2000));
    const bioText = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="og:description"]');
      if (meta?.getAttribute('content')) return meta.getAttribute('content') || '';
      const header = document.querySelector('header');
      return header?.innerText || document.body.innerText.slice(0, 2000);
    });
    return bioText || '';
  } finally {
    await browser.close();
  }
}

async function scrapeWithRapidApi(username: string): Promise<string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_INSTAGRAM_HOST || 'instagram-scraper-api2.p.rapidapi.com';
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  const url = `https://${host}/v1/info?username_or_id_or_url=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': host,
    },
  });
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  const json = (await res.json()) as { biography?: string; bio?: string; data?: { biography?: string } };
  return json.biography || json.bio || json.data?.biography || '';
}

function normalizeBioForMatch(bio: string, code: string): boolean {
  const normalizedBio = bio.replace(/\s+/g, ' ').trim().toUpperCase();
  const normalizedCode = code.replace(/\s+/g, ' ').trim().toUpperCase();
  return normalizedBio.includes(normalizedCode);
}

/** Scrape public Instagram bio and check verification code (docs: Puppeteer + RapidAPI fallback). */
export async function scrapeInstagramBioForCode(
  instagramUsername: string,
  verificationCode: string
): Promise<ScrapeBioResult> {
  const handle = instagramUsername.replace('@', '').trim().toLowerCase();

  if (process.env.SCRAPER_SANDBOX === 'true') {
    console.log(`[Scraper/sandbox] Simulating bio check for @${handle}, code=${verificationCode}`);
    return {
      success: true,
      codeFound: true,
      bioText: `[sandbox mode] Simulated bio containing code ${verificationCode}`,
      source: 'sandbox' as const,
      error: undefined,
    };
  }

  let bioText = '';
  let lastError: string | undefined;

  try {
    bioText = await scrapeWithPuppeteer(handle);
    const codeFound = normalizeBioForMatch(bioText, verificationCode);
    return { success: true, bioText, codeFound, source: 'puppeteer' };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[Scraper] Puppeteer failed, trying RapidAPI:', lastError);
  }

  try {
    bioText = await scrapeWithRapidApi(handle);
    const codeFound = normalizeBioForMatch(bioText, verificationCode);
    return { success: true, bioText, codeFound, source: 'rapidapi' };
  } catch (err) {
    const rapidErr = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      bioText,
      codeFound: false,
      source: 'rapidapi',
      error: `${lastError || 'puppeteer failed'}; rapidapi: ${rapidErr}`,
    };
  }
}

export interface ScrapeFollowingResult {
  success: boolean;
  following: string[];
  isPrivate: boolean;
  source: 'puppeteer' | 'rapidapi' | 'sandbox';
  error?: string;
}

const INSTAGRAM_PATH_SKIP = new Set([
  'explore',
  'reels',
  'direct',
  'accounts',
  'p',
  'stories',
  'about',
  'legal',
  'privacy',
  'terms',
]);

function parseFollowingUsernames(json: Record<string, unknown>): string[] {
  const usernames: string[] = [];
  const add = (value: unknown) => {
    if (typeof value === 'string' && value) {
      usernames.push(value.replace('@', '').trim().toLowerCase());
    }
  };

  const data = json.data as Record<string, unknown> | undefined;
  const items =
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.users) && data.users) ||
    (Array.isArray(json.items) && json.items) ||
    (Array.isArray(json.users) && json.users) ||
    [];

  for (const item of items) {
    if (typeof item === 'string') {
      add(item);
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const nested = row.user as Record<string, unknown> | undefined;
    add(row.username ?? row.user_name ?? nested?.username);
  }

  return usernames;
}

async function scrapeFollowingWithPuppeteer(
  username: string
): Promise<{ following: string[]; isPrivate: boolean }> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const randomDelay = () => new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(`https://www.instagram.com/${username}/`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await randomDelay();

    const isPrivate = await page.evaluate(() =>
      document.body.innerText.includes('This account is private')
    );
    if (isPrivate) {
      return { following: [], isPrivate: true };
    }

    await page.goto(`https://www.instagram.com/${username}/following/`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await randomDelay();

    const collected = new Set<string>();
    let stableRounds = 0;
    for (let i = 0; i < 35 && stableRounds < 4; i++) {
      const before = collected.size;
      const batch: string[] = await page.evaluate((skipList) => {
        const skip = new Set(skipList as string[]);
        const out: string[] = [];
        const root = document.querySelector('[role="dialog"]') || document.body;
        root.querySelectorAll('a[href]').forEach((el) => {
          const href = el.getAttribute('href') || '';
          const match = href.match(/^\/([a-zA-Z0-9._]+)\/?$/);
          if (match && !skip.has(match[1].toLowerCase())) {
            out.push(match[1].toLowerCase());
          }
        });
        return out;
      }, Array.from(INSTAGRAM_PATH_SKIP));

      batch.forEach((u) => collected.add(u));

      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const scrollable =
          (dialog?.querySelector('div[style*="overflow"]') as HTMLElement | null) ||
          (dialog?.querySelector('div > div > div') as HTMLElement | null) ||
          (dialog as HTMLElement | null);
        if (scrollable) scrollable.scrollTop += 800;
      });
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

      if (collected.size === before) stableRounds++;
      else stableRounds = 0;
    }

    return { following: Array.from(collected), isPrivate: false };
  } finally {
    await browser.close();
  }
}

async function scrapeFollowingWithRapidApi(username: string): Promise<string[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_INSTAGRAM_HOST || 'instagram-scraper-api2.p.rapidapi.com';
  if (!apiKey) throw new Error('RAPIDAPI_KEY not configured');

  const url = `https://${host}/v1/following?username_or_id_or_url=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': host,
    },
  });
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  return parseFollowingUsernames(json);
}

/** Scrape public Instagram following list (Puppeteer + RapidAPI fallback). */
export async function scrapeFollowingList(username: string): Promise<ScrapeFollowingResult> {
  const handle = username.replace('@', '').trim().toLowerCase();

  if (process.env.SCRAPER_SANDBOX === 'true') {
    return { success: true, following: [], isPrivate: false, source: 'sandbox' };
  }

  let lastError: string | undefined;

  try {
    const puppeteerResult = await scrapeFollowingWithPuppeteer(handle);
    if (puppeteerResult.isPrivate) {
      return { success: true, following: [], isPrivate: true, source: 'puppeteer' };
    }
    return {
      success: true,
      following: puppeteerResult.following,
      isPrivate: false,
      source: 'puppeteer',
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[Scraper] Puppeteer following failed, trying RapidAPI:', lastError);
  }

  try {
    const following = await scrapeFollowingWithRapidApi(handle);
    return { success: true, following, isPrivate: false, source: 'rapidapi' };
  } catch (err) {
    const rapidErr = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      following: [],
      isPrivate: false,
      source: 'rapidapi',
      error: `${lastError || 'puppeteer failed'}; rapidapi: ${rapidErr}`,
    };
  }
}
