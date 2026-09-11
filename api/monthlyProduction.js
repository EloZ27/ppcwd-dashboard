export default async function handler(req, res) {
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

  // 1. GET: Fetch all records or filter by specific month
  if (req.method === 'GET') {
    try {
      const { month } = req.query;
      let url = `${SUPABASE_URL}/rest/v1/monthly_production?select=*&order=month_year.desc,category.asc,station_name.asc`;
      if (month) {
        url = `${SUPABASE_URL}/rest/v1/monthly_production?month_year=eq.${month}&select=*&order=category.asc,station_name.asc`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST: Batch Upsert records for a specific month
  if (req.method === 'POST') {
    try {
      const { records } = req.body;
      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Payload must contain a non-empty records array.' });
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/monthly_production?on_conflict=month_year,station_name`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(records)
      });

      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      return res.status(200).json({ success: true, count: data.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}