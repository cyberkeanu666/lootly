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
    return {
      success: true,
      bioText: `[sandbox] LOOTLY verification for @${handle}`,
      codeFound: true,
      source: 'sandbox',
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
