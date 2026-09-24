// api/saveProductionWeekly.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const { action, id, week_label, date_recorded, period_label, row_data, metadata } = req.body;

  try {
    // 1. DELETE ACTION
    if (action === 'delete') {
      const targetId = id || week_label;
      if (!targetId) {
        return res.status(400).json({ error: 'id or week_label is required for deletion.' });
      }

      let delRes;
      if (id) {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers
        });
      } else {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly?week_label=eq.${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers
        });
      }

      if (!delRes.ok) throw new Error(await delRes.text());
      return res.status(200).json({ success: true, message: 'Production record deleted successfully.' });
    }

    // 2. SAVE / UPSERT ACTION
    if (action === 'save' || week_label) {
      if (!week_label) {
        return res.status(400).json({ error: 'week_label is required (e.g. Week 25).' });
      }
      if (!Array.isArray(row_data) || row_data.length < 53) {
        return res.status(400).json({ error: 'row_data must be an array of at least 53 elements matching standard production schema.' });
      }

      // Check if record already exists for this week_label or id
      let existing = [];
      if (id) {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly?id=eq.${encodeURIComponent(id)}&select=id`, { headers });
        if (checkRes.ok) existing = await checkRes.json();
      } else {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly?week_label=eq.${encodeURIComponent(week_label)}&select=id`, { headers });
        if (checkRes.ok) existing = await checkRes.json();
      }

      const payload = {
        week_label,
        date_recorded: date_recorded || row_data[1] || new Date().toISOString().split('T')[0],
        period_label: period_label || row_data[2] || '',
        row_data
      };

      let saveRes;
      if (existing.length > 0) {
        const existingId = existing[0].id;
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly?id=eq.${existingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(payload)
        });
      } else {
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/production_weekly`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      }

      if (!saveRes.ok) throw new Error(await saveRes.text());
      const data = await saveRes.json();
      return res.status(200).json({
        success: true,
        message: existing.length > 0 ? `Production data for ${week_label} updated!` : `Production data for ${week_label} saved!`,
        data: data[0]
      });
    }

    return res.status(400).json({ error: 'Invalid action. Supported: save, delete' });
  } catch (err) {
    console.error('saveProductionWeekly error:', err);
    return res.status(500).json({ error: err.message });
  }
}

