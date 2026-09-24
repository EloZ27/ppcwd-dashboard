// api/verifyPasskey.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configuredPasskey = process.env.ADMIN_PASSKEY || 'ppcwd2026';
  const providedPasskey = req.headers['x-admin-passkey'] || req.body?.passkey;

  if (!providedPasskey) {
    return res.status(401).json({ success: false, error: 'Please enter the authorization passkey.' });
  }

  if (providedPasskey !== configuredPasskey) {
    return res.status(401).json({ success: false, error: 'Invalid authorization passkey.' });
  }

  return res.status(200).json({ success: true, message: 'Passkey authorized.' });
}

