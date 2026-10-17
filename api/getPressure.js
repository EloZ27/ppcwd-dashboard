// api/getPressure.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase credentials missing on server' });
  }

  // 1. Column minimization: project only columns consumed by the dashboard (saves ~62% payload per row)
  let queryParams = 'select=reading_time,station_name,psi';

  const since = req.query.since;
  const start = req.query.start;
  const end = req.query.end;

  if (since) {
    // Delta sync: fetch newer readings since the newest cached timestamp (gte to avoid boundary omissions)
    queryParams += `&reading_time=gte.${encodeURIComponent(since)}&order=reading_time.asc&limit=10000`;
  } else if (start && end) {
    // Range query: fetch specific window for reports or deep historical view
    queryParams += `&reading_time=gte.${encodeURIComponent(start)}&reading_time=lte.${encodeURIComponent(end)}&order=reading_time.asc&limit=10000`;
  } else {
    // Default initial load: fetch the most recent batch of up to 8,000 readings (~16-20 days initial buffer)
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8000, 100), 10000);
    queryParams += `&order=reading_time.desc&limit=${limit}`;
  }

  const url = `${SUPABASE_URL}/rest/v1/pressure_readings?${queryParams}`;

  try {
    const headers = { 
      'apikey': SUPABASE_KEY,
      'Accept': 'application/json'
    };
    if (SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Supabase returned ${response.status}`, details: errText });
    }

    const data = await response.json();

    // Cache-Control optimization for Vercel Edge CDN
    if (req.query && (req.query.nocache === '1' || req.query.bypass === '1')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else if (start && end) {
      // Historical date ranges are immutable: cache at edge for 1 hour
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
    } else if (since) {
      // Delta sync queries: short Edge cache (60s) to absorb concurrent hits
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    } else {
      // Initial load: 3-minute Edge cache
      res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=60');
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch from Supabase database", message: error.message });
  }
}
