/**
 * Vercel Serverless Function - ForexFactory Calendar Proxy
 * Proxies requests to nfs.faireconomy.media (bypasses browser CORS restriction)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TradingJournal/1.0)',
  'Accept': 'application/json',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const [thisWeek, nextWeek] = await Promise.allSettled([
      fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { headers: HEADERS }),
      fetch('https://nfs.faireconomy.media/ff_calendar_nextweek.json', { headers: HEADERS }),
    ]);

    const all: unknown[] = [];

    if (thisWeek.status === 'fulfilled' && thisWeek.value.ok) {
      const data = await thisWeek.value.json() as unknown[];
      all.push(...data);
    }
    if (nextWeek.status === 'fulfilled' && nextWeek.value.ok) {
      const data = await nextWeek.value.json() as unknown[];
      all.push(...data);
    }

    if (all.length === 0) {
      return res.status(503).json({ error: 'Calendar feeds temporarily unavailable' });
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(all);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(503).json({ error: 'Failed to fetch calendar data' });
  }
}
