/**
 * Vercel Serverless Function - ForexFactory Calendar Proxy
 * Proxies requests to nfs.faireconomy.media (bypasses browser CORS restriction)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TradingJournal/1.0)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Upstream error: ${response.statusText}` });
    }

    const data = await response.json();

    // Cache for 15 minutes at CDN level
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Calendar proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
}
