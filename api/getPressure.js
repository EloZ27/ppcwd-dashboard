// api/getPressure.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  // INCREASED LIMIT TO 5,000 (roughly 10 days of data for 20 stations)
  const url = `${SUPABASE_URL}/rest/v1/pressure_readings?select=&order=reading_time.desc&limit=3500`;

  try {
    const headers = { 'apikey': SUPABASE_KEY };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const data = await response.json();

    if (req.query && (req.query.t || req.query.nocache)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=59');
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch from Supabase database" });
  }
}
