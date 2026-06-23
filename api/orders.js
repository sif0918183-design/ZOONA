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
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app'
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. Extract target endpoint
  // Usage: /api/orders?endpoint=table_name?select=*
  const fullUrl = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = fullUrl.searchParams.get('endpoint');

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint query parameter is required' });
  }

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

    // Handle 204 No Content
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
