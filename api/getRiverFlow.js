export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  const url = `${SUPABASE_URL}/rest/v1/river_flow?recorded_date=neq.1970-01-01&select=*&order=recorded_date.desc`;

  try {
    const headers = { 'apikey': SUPABASE_KEY };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(url, { headers });
    
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    
    const data = await response.json();
    const cleanData = (Array.isArray(data) ? data : []).filter(r => 
      r.recorded_date !== '1970-01-01' && 
      (!Array.isArray(r.readings) || r.readings[0] !== '__RIVER_STATIONS_CONFIG__')
    );
    res.status(200).json(cleanData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch River Flow data" });
  }
}
