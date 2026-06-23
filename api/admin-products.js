/**
 * Vercel API: /api/admin-products
 * يقوم بالعمليات على المنتجات (CRUD) في Supabase مع إخفاء المفاتيح عن المتصفح.
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
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app',
    'https://zoona-git-login-synchronization-and-secu-5e5d31-sifians-projects.vercel.app'
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. جلب متغيرات البيئة
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 4. Server-side Authorization for Admin Actions
  const isWriteOp = ['POST', 'PATCH', 'DELETE'].includes(req.method);
  if (isWriteOp) {
    let adminPassword = req.query.adminPassword;

    // Try to get password from body if not in query
    if (!adminPassword && req.body) {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      adminPassword = body.adminPassword;
    }

    if (!adminPassword) {
      return res.status(401).json({ error: 'Admin password required for this operation' });
    }

    // Hash the provided password
    const crypto = await import('crypto');
    const hashedProvided = crypto.createHash('sha256').update(adminPassword).digest('hex');

    // Verify hashed password against DB
    const authUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
    const authResponse = await fetch(authUrl, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const authData = await authResponse.json();

    if (!authData || authData.length === 0 || authData[0].value !== hashedProvided) {
      return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
    }
  }

  try {
    const { id } = req.query;
    const baseUrl = `${SUPABASE_URL}/rest/v1/products`;
    let fetchUrl = '';
    let fetchOptions = {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': req.method === 'POST' ? 'return=representation' : 'return=minimal'
      }
    };

    if (req.method === 'GET') {
      fetchUrl = id ? `${baseUrl}?id=eq.${id}&select=*` : `${baseUrl}?select=*&order=id.desc`;
    } 
    else if (req.method === 'POST') {
      fetchUrl = baseUrl;
      let bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (bodyData && typeof bodyData === 'object') {
        delete bodyData.adminPassword;
        delete bodyData.action;
      }
      fetchOptions.body = JSON.stringify(bodyData);
    } 
    else if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'Product ID is required' });
      fetchUrl = `${baseUrl}?id=eq.${id}`;
      let bodyData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (bodyData && typeof bodyData === 'object') {
        delete bodyData.adminPassword;
        delete bodyData.action;
      }
      fetchOptions.body = JSON.stringify({ ...bodyData, updated_at: new Date().toISOString() });
    } 
    else if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Product ID is required' });
      fetchUrl = `${baseUrl}?id=eq.${id}`;
    }

    const response = await fetch(fetchUrl, fetchOptions);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase error: ${response.status} - ${errorText}`);
    }

    if (response.status === 204) return res.status(204).end();

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const result = await response.json();
      return res.status(200).json(req.method === 'DELETE' ? { success: true } : result);
    } else {
      const text = await response.text();
      return res.status(200).send(text);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
