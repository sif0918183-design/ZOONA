import { generateTopSignature, getTopTimestamp, parseAliExpressInput } from '../aliexpress-helpers.js';

export default async function handler(req, res) {
  // CORS & Origin Check
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com'
  ];

  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + "/"));
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  const currentOrigin = req.headers.origin;
  if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Admin Auth Verification
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  let adminPassword = req.query.adminPassword;
  if (!adminPassword && req.body) {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      adminPassword = body.adminPassword;
    } catch (e) {}
  }

  if (!adminPassword) {
    return res.status(401).json({ error: 'Admin password required' });
  }

  const crypto = await import('crypto');
  const hashedProvided = crypto.createHash('sha256').update(adminPassword).digest('hex');

  const authUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
  const authResponse = await fetch(authUrl, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  });

  if (!authResponse.ok) {
    return res.status(500).json({ error: 'Internal Auth Verification Failed' });
  }

  const authData = await authResponse.json();
  if (!authData || authData.length === 0 || authData[0].value !== hashedProvided) {
    return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
  }

  // AliExpress API Credentials from Env
  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

  if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
    return res.status(500).json({ error: 'AliExpress API credentials not configured in environment variables' });
  }

  const queryInput = req.query.q || (req.body && req.body.q) || '';
  if (!queryInput) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }

  const parsed = parseAliExpressInput(queryInput);

  try {
    const timestamp = getTopTimestamp();
    let method = 'aliexpress.affiliate.product.query';
    let apiParams = {
      app_key: APP_KEY,
      method: method,
      timestamp: timestamp,
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      tracking_id: TRACKING_ID,
      target_currency: 'USD',
      target_language: 'AR'
    };

    if (parsed.type === 'product_id') {
      apiParams.product_ids = parsed.value;
    } else {
      apiParams.keywords = parsed.value;
      apiParams.page_no = '1';
      apiParams.page_size = '20';
    }

    const sign = generateTopSignature(apiParams, APP_SECRET);
    apiParams.sign = sign;

    const urlParams = new URLSearchParams(apiParams);
    const aliRes = await fetch(`https://api-sg.aliexpress.com/sync?${urlParams.toString()}`, {
      method: 'GET'
    });

    if (!aliRes.ok) {
      const errText = await aliRes.text();
      return res.status(502).json({ error: 'Failed to communicate with AliExpress API', details: errText });
    }

    const aliData = await aliRes.json();

    // Extract items
    let products = [];
    const responseObj = aliData.aliexpress_affiliate_product_query_response;
    if (responseObj && responseObj.resp_result && responseObj.resp_result.result) {
      const resultObj = responseObj.resp_result.result;
      if (resultObj.products && resultObj.products.product) {
        const rawProducts = Array.isArray(resultObj.products.product) ? resultObj.products.product : [resultObj.products.product];
        products = rawProducts.map(item => ({
          source_product_id: item.product_id ? item.product_id.toString() : '',
          name_ar: item.product_title || '',
          image_url: item.product_main_image_url || '',
          price: item.target_sale_price || item.target_original_price || item.app_sale_price || 0,
          currency: item.target_sale_price_currency || 'USD',
          product_detail_url: item.product_detail_url || '',
          promotion_link: item.promotion_link || ''
        }));
      }
    }

    return res.status(200).json({ success: true, count: products.length, products });

  } catch (err) {
    console.error('Error querying AliExpress:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
