export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  const url = `${SUPABASE_URL}/rest/v1/river_flow?select=*&order=recorded_date.desc`;

  try {
    const headers = { 'apikey': SUPABASE_KEY };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch River Flow data" });
  }
}