/**
 * Vercel API: /api/admin-auth
 * للتحقق من كلمة مرور المسؤول عبر Supabase باستخدام Service Role Key.
 */

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com',
    'https://zoona-git-secure-supabase-keys-77307646-147e2c-sifians-projects.vercel.app',
    'https://zoona-git-indicate-out-of-stock-markete-081854-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app',
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app',
    'https://zoona-git-secure-tiered-commission-v2-d1be82-sifians-projects.vercel.app',
    'https://zoona-git-fix-admin-login-and-rls-v3-203597-sifians-projects.vercel.app'
  ];

  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + "/"));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. CORS Headers
  const currentOrigin = req.headers.origin;
  if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 3. جلب متغيرات البيئة - استخدام Service Role Key لتجاوز RLS
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Supabase Service Role Key missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { password } = req.query;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Hash the provided password using SHA-256
    const crypto = await import('crypto');
    const hashedProvided = crypto.createHash('sha256').update(password).digest('hex');

    // 4. التحقق من كلمة المرور من Supabase باستخدام Service Key
    const fetchUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
    
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Admin-Auth] Supabase Fetch Error:', response.status, errorText);
      return res.status(200).json({ valid: false, error: 'Database fetch failed' });
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.error('[Admin-Auth] No data returned for admin_password even with Service Role Key. Check key configuration.');
      return res.status(200).json({ valid: false, error: 'Settings row missing' });
    }

    const valid = data[0].value === hashedProvided;

    return res.status(200).json({ valid });

  } catch (error) {
    console.error('[Admin-Auth] Error:', error.message);
    return res.status(500).json({ valid: false, error: error.message });
  }
}
