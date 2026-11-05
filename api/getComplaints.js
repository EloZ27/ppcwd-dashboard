import crypto from 'crypto';

// Canonical Barangay Name Normalizer (standardizes case, spacing, and punctuation)
function normalizeBarangayName(str) {
  if (!str) return 'UNKNOWN';
  let s = String(str).trim().toUpperCase().replace(/\s+/g, ' ');
  if (s === 'BANCAO BANCAO' || s === 'BANCAO-BANCAO' || s === 'BANCAO - BANCAO' || s === 'BANCAO_BANCAO') return 'BANCAO-BANCAO';
  if (s === 'STA LOURDES' || s === 'STA. LOURDES' || s === 'SANTA LOURDES') return 'STA. LOURDES';
  if (s === 'STA MONICA' || s === 'STA. MONICA' || s === 'SANTA MONICA') return 'STA. MONICA';
  if (s === 'SAN MIGUEL') return 'SAN MIGUEL';
  if (s.startsWith('STA ') && !s.startsWith('STA. ')) return 'STA. ' + s.slice(4);
  if (s.startsWith('SANTA ')) return 'STA. ' + s.slice(6);
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
  };
  if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
    headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
  }

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

    // Check if requester has admin authorization (constant-time comparison)
    const configuredPasskey = process.env.ADMIN_PASSKEY;
    const providedPasskey = req.headers['x-admin-passkey'];
    let isAdmin = false;
    if (configuredPasskey && providedPasskey && typeof providedPasskey === 'string') {
      const provBuf = Buffer.from(String(providedPasskey));
      const confBuf = Buffer.from(String(configuredPasskey));
      isAdmin = provBuf.length === confBuf.length && crypto.timingSafeEqual(provBuf, confBuf);
    }

    // Server-side normalization and PII masking
    const sanitized = (data || []).map(record => {
      const normBrgy = normalizeBarangayName(record.barangay);
      if (isAdmin) {
        return {
          ...record,
          barangay: normBrgy
        };
      }

      const rawAcc = String(record.account_number || record.account_no || '').trim();
      const cleanAcc = rawAcc.replace(/[^a-zA-Z0-9]/g, '');
      const maskedAcc = cleanAcc.length > 4 ? `••••• ${cleanAcc.slice(-4)}` : (cleanAcc ? '••••••••' : null);

      return {
        ...record,
        barangay: normBrgy,
        account_number: maskedAcc,
        account_no: maskedAcc
      };
    });

    res.status(200).json(sanitized);
  } catch (error) {
    console.error('getComplaints API error:', error);
    res.status(500).json({ error: 'Failed to retrieve complaints data.' });
  }
}
