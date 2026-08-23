// api/getPressure.js
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  // INCREASED LIMIT TO 5,000 (roughly 10 days of data for 20 stations)
  const url = `${SUPABASE_URL}/rest/v1/pressure_readings?select=&order=reading_time.desc&limit=4000`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=59');

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch from Supabase database" });
  }
}
