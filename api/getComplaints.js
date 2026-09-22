export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  };

  try {
    // 1. Try ordering by date.desc
    let response = await fetch(`${SUPABASE_URL}/rest/v1/complaints?select=*&order=date.desc`, { headers });
    
    // 2. Fallback to unordered query if column ordering error occurs
    if (!response.ok) {
      response = await fetch(`${SUPABASE_URL}/rest/v1/complaints?select=*`, { headers });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch complaints from Supabase: ${errText}`);
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('getComplaints API error:', error);
    res.status(500).json({ error: error.message });
  }
}