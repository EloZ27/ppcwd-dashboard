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

  const configuredPasskey = process.env.ADMIN_PASSKEY || 'ppcwd2026';
  const providedPasskey = req.headers['x-admin-passkey'] || req.body?.admin_passkey;

  if (!providedPasskey || providedPasskey !== configuredPasskey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrator passkey.' });
  }

  const { action, id, recorded_date, readings, readings_map } = req.body;

  try {
    // 1. DELETE RECORD
    if (action === 'delete') {
      const targetId = id || req.body.recorded_date;
      if (!targetId) return res.status(400).json({ error: 'id or recorded_date is required for deletion.' });

      let delRes;
      if (id) {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers
        });
      } else {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers
        });
      }

      if (!delRes.ok) throw new Error(await delRes.text());
      return res.status(200).json({ success: true, message: 'River flow record deleted successfully.' });
    }

    // 2. SAVE / UPSERT RECORD
    if (action === 'save' || recorded_date) {
      if (!recorded_date) {
        return res.status(400).json({ error: 'recorded_date is required (YYYY-MM-DD).' });
      }

      // Build standard 21-element readings array
      let finalReadings = Array.isArray(readings) && readings.length >= 21 ? [...readings] : null;

      if (!finalReadings) {
        finalReadings = new Array(21).fill(null);
        finalReadings[0] = "Discharge (m3/day)";

        // Format Date string: e.g. "September 8, 2026"
        const [y, m, d] = recorded_date.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        finalReadings[1] = `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;

        // Populate readings_map indices 2..20
        if (readings_map && typeof readings_map === 'object') {
          for (let col = 2; col <= 20; col++) {
            const rawVal = readings_map[col];
            if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
              const numVal = parseFloat(String(rawVal).replace(/,/g, ''));
              finalReadings[col] = isNaN(numVal) ? null : numVal;
            } else {
              finalReadings[col] = null;
            }
          }
        }
      }

      // Check if record already exists for this recorded_date
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.${recorded_date}&select=id`, {
        headers
      });
      const existing = checkRes.ok ? await checkRes.json() : [];

      let saveRes;
      if (existing.length > 0) {
        // UPDATE existing row
        const existingId = existing[0].id;
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?id=eq.${existingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            recorded_date,
            readings: finalReadings
          })
        });
      } else {
        // INSERT new row
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recorded_date,
            readings: finalReadings
          })
        });
      }

      if (!saveRes.ok) throw new Error(await saveRes.text());
      const data = await saveRes.json();
      return res.status(200).json({
        success: true,
        message: existing.length > 0 ? 'River flow readings updated!' : 'River flow readings saved!',
        data: data[0]
      });
    }

    return res.status(400).json({ error: 'Invalid action. Supported: save, delete' });
  } catch (err) {
    console.error('saveRiverFlow error:', err);
    return res.status(500).json({ error: err.message });
  }
}

