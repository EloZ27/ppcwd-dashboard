export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    // Fetch genset inventory and maintenance logs concurrently
    const [gRes, lRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/gensets?select=*&order=genset_no.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/genset_logs?select=*&order=log_date.desc`, { headers })
    ]);

    if (!gRes.ok) {
      const errText = await gRes.text();
      throw new Error(`Gensets table error: ${errText}`);
    }

    const gensets = await gRes.json();
    const logs = lRes.ok ? await lRes.json() : [];

    // Attach matching logs to each generator
    const merged = (gensets || []).map(g => ({
      ...g,
      genset_logs: (logs || []).filter(l => l.genset_id === g.id)
    }));

    return res.status(200).json(merged);
  } catch (err) {
    console.error('getGensets error:', err);
    return res.status(500).json({ error: err.message });
  }
}