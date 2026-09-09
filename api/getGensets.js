const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Missing Supabase credentials in Vercel. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch Gensets
    const { data: gensets, error: gErr } = await supabase
      .from('gensets')
      .select('*')
      .order('genset_no', { ascending: true });

    if (gErr) throw gErr;

    // 2. Fetch Logs safely
    const { data: logs, error: lErr } = await supabase
      .from('genset_logs')
      .select('*')
      .order('log_date', { ascending: false });

    if (lErr) console.warn('Could not load logs:', lErr.message);

    const merged = (gensets || []).map(g => ({
      ...g,
      genset_logs: (logs || []).filter(l => l.genset_id === g.id)
    }));

    return res.status(200).json(merged);
  } catch (err) {
    console.error('getGensets error:', err);
    return res.status(500).json({ error: err.message || 'Database query error' });
  }
};