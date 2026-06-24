/**
 * Vercel API: /api/orders
 * Acts as a secure proxy for Supabase to hide keys and restrict access.
 */

export default async function handler(req, res) {
  // 1. Origin Restriction
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
    'https://zoona-git-login-synchronization-and-secu-5e5d31-sifians-projects.vercel.app',
    'https://zoona-git-secure-tiered-commission-v2-d1be82-sifians-projects.vercel.app',
    'https://zoona-git-fix-admin-login-and-rls-v3-203597-sifians-projects.vercel.app'
  ];

  // Check if origin starts with any allowed origin
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer, apikey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Supabase Credentials from Environment Variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. Extract target endpoint and auth info
  const fullUrl = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = fullUrl.searchParams.get('endpoint');
  const action = fullUrl.searchParams.get('action');
  const adminPassword = fullUrl.searchParams.get('adminPassword');

  // Specialized Action: Affiliate Login (uses SERVICE_KEY for privacy)
  if (action === 'login_affiliate') {
    const { affiliateId, password } = req.body;
    if (!affiliateId || !password) return res.status(400).json({ error: 'Missing credentials' });

    const key = SERVICE_KEY || SUPABASE_KEY;
    const fetchUrl = `${SUPABASE_URL}/rest/v1/affiliate_users?affiliate_id=eq.${encodeURIComponent(affiliateId)}&select=*`;
    const response = await fetch(fetchUrl, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (!response.ok) return res.status(response.status).json({ error: 'Auth fetch failed' });

    const data = await response.json();

    if (!data || data.length === 0 || data[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = data[0];
    delete user.password; // Privacy: Remove password before returning
    return res.status(200).json({ success: true, affiliate: user });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint query parameter is required' });
  }

  // 5. Server-side Authorization for Admin Actions
  const isWriteOp = ['POST', 'PATCH', 'DELETE'].includes(req.method);
  const isAdminTable = endpoint.includes('admin_settings');
  const isSensitiveAffiliateOp = endpoint.includes('affiliate_users') && req.method === 'PATCH';

  if (isWriteOp || isAdminTable || isSensitiveAffiliateOp) {
    // Public non-sensitive settings (Rates & Threshold) can be fetched via GET without password
    const isPublicSelect = req.method === 'GET' &&
                          endpoint.includes('admin_settings') &&
                          !endpoint.includes('admin_password');

    if (!isPublicSelect) {
      if (!adminPassword) {
        return res.status(401).json({ error: 'Admin password required for this operation' });
      }

      // Hash provided password to compare with DB
      const crypto = await import('crypto');
      const hashedProvided = crypto.createHash('sha256').update(adminPassword).digest('hex');

      // Verify hashed password against DB using SERVICE_KEY to bypass RLS
      const key = SERVICE_KEY || SUPABASE_KEY;
      const authUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
      const authResponse = await fetch(authUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });

      if (!authResponse.ok) {
          console.error('[Orders-Proxy] Auth Fetch Failed:', authResponse.status);
          return res.status(500).json({ error: 'Internal Auth Error' });
      }

      const authData = await authResponse.json();

      if (!authData || authData.length === 0 || authData[0].value !== hashedProvided) {
        console.error('[Orders-Proxy] Unauthorized access attempt or row missing.');
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
      }
    }
  }

  // Proceed with the actual request
  const fetchUrl = `${SUPABASE_URL}/rest/v1/${endpoint}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': req.headers['prefer'] || (req.method === 'POST' ? 'return=representation' : 'return=minimal')
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(fetchUrl, fetchOptions);

    if (response.status === 204) {
      return res.status(204).end();
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
