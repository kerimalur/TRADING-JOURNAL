/**
 * Vercel Serverless Function - ForexFactory Calendar Proxy
 * Proxies requests to nfs.faireconomy.media (bypasses browser CORS restriction)
 *
 * Robust: timeouts, defensive JSON parsing, and NEVER throws a 5xx — on any
 * failure it returns 200 with an empty array so the client degrades gracefully
 * (kein roter Konsolen-Fehler, UI zeigt einfach "keine Events").
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TradingJournal/1.0)',
  'Accept': 'application/json,text/plain,*/*',
};

const FEEDS = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
];

async function fetchFeed(url: string): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!resp.ok) return [];
    // Defensiv: erst Text holen, dann JSON.parse (Feed liefert manchmal HTML/Blockseite)
    const text = await resp.text();
    const trimmed = text.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return [];
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    const all = results.flat();

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    // Immer 200 — leeres Array statt Fehler, damit der Client nicht rot wird.
    return res.status(200).json(all);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(200).json([]);
  }
}
