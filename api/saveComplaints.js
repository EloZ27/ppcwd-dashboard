export default async function handler(req, res) {
  if (req.method !== 'POST') {
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
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const configuredPasskey = process.env.ADMIN_PASSKEY || 'ppcwd2026';
  const providedPasskey = req.headers['x-admin-passkey'] || req.body?.admin_passkey;

  if (!providedPasskey || providedPasskey !== configuredPasskey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrator passkey.' });
  }

  const { action, record, records, id } = req.body;

  try {
    // 1. DELETE COMPLAINT RECORD
    if (action === 'delete') {
      const targetId = id || req.body.jo_number;
      if (!targetId) return res.status(400).json({ error: 'id or jo_number is required for deletion.' });

      let delRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints?jo_number=eq.${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        headers
      });

      if (!delRes.ok) {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints?id=eq.${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers
        });
      }

      if (!delRes.ok) throw new Error(await delRes.text());
      return res.status(200).json({ success: true, message: 'Complaint record deleted successfully.' });
    }

    // 2. BULK INGESTION (Paste / CSV Import)
    if (action === 'bulk') {
      if (!records || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ error: 'Payload must contain a non-empty records array.' });
      }

      const formatted = records.map((r, idx) => ({
        jo_number: r.jo_number || `WEB-${Date.now()}-${idx + 1}-${Math.floor(Math.random() * 1000)}`,
        date: r.date || new Date().toISOString().split('T')[0],
        barangay: r.barangay ? String(r.barangay).trim() : 'Unknown',
        stub_out_no: r.stub_out_no || r.stubout_number || r.stubout || r.stubout_no || null,
        account_number: r.account_number || r.account_no || null,
        type: r.type || 'No Water',
        complaint_count: parseInt(r.complaint_count, 10) || 1,
        consumer_remarks: r.consumer_remarks || r.remarks || null
      }));

      const bulkRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formatted)
      });

      if (!bulkRes.ok) throw new Error(await bulkRes.text());
      const data = await bulkRes.json();
      return res.status(200).json({ success: true, count: data.length, data });
    }

    // 3. SINGLE RECORD CREATION
    if (action === 'create' || record) {
      const dataToSave = record || req.body;
      if (!dataToSave.barangay || !dataToSave.date) {
        return res.status(400).json({ error: 'Date and Barangay are required.' });
      }

      const singlePayload = {
        jo_number: dataToSave.jo_number || `WEB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: dataToSave.date,
        barangay: String(dataToSave.barangay).trim(),
        stub_out_no: dataToSave.stub_out_no || dataToSave.stubout_number || dataToSave.stubout || dataToSave.stubout_no || null,
        account_number: dataToSave.account_number || dataToSave.account_no || null,
        type: dataToSave.type || 'No Water',
        complaint_count: parseInt(dataToSave.complaint_count, 10) || 1,
        consumer_remarks: dataToSave.consumer_remarks || dataToSave.remarks || null
      };

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/complaints`, {
        method: 'POST',
        headers,
        body: JSON.stringify(singlePayload)
      });

      if (!createRes.ok) throw new Error(await createRes.text());
      const created = await createRes.json();
      return res.status(200).json({ success: true, message: 'Complaint logged successfully.', data: created[0] });
    }

    return res.status(400).json({ error: 'Invalid action specified. Supported: create, bulk, delete' });
  } catch (err) {
    console.error('saveComplaints error:', err);
    return res.status(500).json({ error: err.message });
  }
}

