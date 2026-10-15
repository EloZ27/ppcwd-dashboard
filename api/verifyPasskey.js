// api/verifyPasskey.js
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const configuredPasskey = process.env.ADMIN_PASSKEY || 'ppcwd2026';
  const providedPasskey = req.headers['x-admin-passkey'] || req.body?.passkey;

  if (!providedPasskey || typeof providedPasskey !== 'string') {
    return res.status(401).json({ success: false, error: 'Please enter the authorization passkey.' });
  }

  // Constant-time comparison to prevent timing attacks
  const provBuf = Buffer.from(String(providedPasskey));
  const confBuf = Buffer.from(String(configuredPasskey));
  const isValid = provBuf.length === confBuf.length && crypto.timingSafeEqual(provBuf, confBuf);

  if (!isValid) {
    return res.status(401).json({ success: false, error: 'Invalid authorization passkey.' });
  }

  return res.status(200).json({ success: true, message: 'Passkey authorized.' });
}

