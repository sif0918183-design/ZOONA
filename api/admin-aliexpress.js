import { generateTopSignature, getTopTimestamp, parseAliExpressInput, generateSlug } from '../lib/aliexpress-helpers.js';

export default async function handler(req, res) {
  // CORS & Origin Check
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    "https://zoona-git-jules-7250375803931180038-595003bf-sifians-projects.vercel.app",
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Admin Auth Verification
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase server configuration' });
  }

  let adminPassword = req.query.adminPassword;
  let reqBody = {};
  if (req.body) {
    try {
      reqBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!adminPassword) adminPassword = reqBody.adminPassword;
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

  const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
  const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
  const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;

  const action = req.query.action || reqBody.action;

  // 1. ACTION: SEARCH via AliExpress API
  if (action === 'search' || (req.method === 'GET' && req.query.q)) {
    if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
      return res.status(500).json({ error: 'AliExpress API credentials not configured in environment variables' });
    }

    const queryInput = req.query.q || reqBody.q || '';
    if (!queryInput) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }

    const parsed = parseAliExpressInput(queryInput);

    try {
      const timestamp = getTopTimestamp();
      let apiParams = {
        app_key: APP_KEY,
        method: 'aliexpress.affiliate.product.query',
        timestamp: timestamp,
        format: 'json',
        v: '2.0',
        sign_method: 'md5',
        tracking_id: TRACKING_ID,
        target_currency: 'USD',
        target_language: 'AR'
      };

      const pageNo = req.query.page || reqBody.page || '1';

      if (parsed.type === 'product_id') {
        apiParams.product_ids = parsed.value;
      } else {
        apiParams.keywords = parsed.value;
        apiParams.page_no = pageNo.toString();
        apiParams.page_size = '20';
      }

      const sign = generateTopSignature(apiParams, APP_SECRET);
      apiParams.sign = sign;

      const urlParams = new URLSearchParams(apiParams);
      const aliRes = await fetch(`https://api-sg.aliexpress.com/sync?${urlParams.toString()}`);

      if (!aliRes.ok) {
        const errText = await aliRes.text();
        return res.status(502).json({ error: 'Failed to communicate with AliExpress API', details: errText });
      }

      const aliData = await aliRes.json();
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

  // 2. GET: Fetch all imported products for Admin management
  if (req.method === 'GET') {
    try {
      const fetchUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?select=*&order=created_at.desc`;
      const response = await fetch(fetchUrl, {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });
      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch aliexpress products', message: err.message });
    }
  }

  // Helper: Generate Affiliate Link via AliExpress API
  async function generateAffiliateLink(sourceUrl) {
    if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
      return sourceUrl;
    }

    try {
      const timestamp = getTopTimestamp();
      const apiParams = {
        app_key: APP_KEY,
        method: 'aliexpress.affiliate.link.generate',
        timestamp: timestamp,
        format: 'json',
        v: '2.0',
        sign_method: 'md5',
        promotion_link_type: '0',
        source_values: sourceUrl,
        tracking_id: TRACKING_ID
      };

      const sign = generateTopSignature(apiParams, APP_SECRET);
      apiParams.sign = sign;

      const urlParams = new URLSearchParams(apiParams);
      const aliRes = await fetch(`https://api-sg.aliexpress.com/sync?${urlParams.toString()}`);
      if (aliRes.ok) {
        const aliData = await aliRes.json();
        const respObj = aliData.aliexpress_affiliate_link_generate_response;
        if (respObj && respObj.resp_result && respObj.resp_result.result) {
          const links = respObj.resp_result.result.promotion_links;
          if (links && links.promotion_link) {
            const linkObj = Array.isArray(links.promotion_link) ? links.promotion_link[0] : links.promotion_link;
            return linkObj.promotion_link || sourceUrl;
          }
        }
      }
    } catch (e) {
      console.error('Error generating affiliate link:', e);
    }
    return sourceUrl;
  }

  // 3. POST: Add a new product to store
  if (req.method === 'POST') {
    try {
      const { source_product_id, name_ar, description_ar, category, image_url, price, currency, product_detail_url, promotion_link } = reqBody;

      if (!source_product_id || !name_ar || !image_url) {
        return res.status(400).json({ error: 'Missing required product fields' });
      }

      // Duplicate Check
      const checkUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?source_product_id=eq.${encodeURIComponent(source_product_id)}&select=id`;
      const checkRes = await fetch(checkUrl, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        return res.status(409).json({ error: 'هذا المنتج موجود بالفعل في المتجر.' });
      }

      // Generate Affiliate Link
      let finalAffiliateLink = promotion_link;
      if (!finalAffiliateLink) {
        const targetUrl = product_detail_url || `https://www.aliexpress.com/item/${source_product_id}.html`;
        finalAffiliateLink = await generateAffiliateLink(targetUrl);
      }

      // Generate unique slug
      let slug = generateSlug(name_ar);
      const slugCheckUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?slug=eq.${encodeURIComponent(slug)}&select=id`;
      const slugCheckRes = await fetch(slugCheckUrl, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      });
      const slugCheckData = await slugCheckRes.json();
      if (slugCheckData && slugCheckData.length > 0) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }

      const newProduct = {
        slug,
        name_ar,
        description_ar: description_ar || '',
        category: category || 'عام',
        image_url,
        price: parseFloat(price) || 0,
        currency: currency || 'USD',
        affiliate_link: finalAffiliateLink,
        source_product_id: source_product_id.toString(),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const insertUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products`;
      const insertRes = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([newProduct])
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return res.status(500).json({ error: 'Failed to insert product into database', details: errText });
      }

      const insertedData = await insertRes.json();
      return res.status(201).json({ success: true, product: insertedData[0] });

    } catch (err) {
      return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  }

  // 4. PATCH: Edit product or update price
  if (req.method === 'PATCH') {
    try {
      const id = req.query.id || reqBody.id;

      if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }

      // Refresh price action
      if (action === 'update_price') {
        const getUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?id=eq.${id}&select=source_product_id`;
        const getRes = await fetch(getUrl, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        const getData = await getRes.json();
        if (!getData || getData.length === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }

        const sourceProductId = getData[0].source_product_id;

        let newPrice = null;
        if (APP_KEY && APP_SECRET) {
          const timestamp = getTopTimestamp();
          const apiParams = {
            app_key: APP_KEY,
            method: 'aliexpress.affiliate.product.query',
            timestamp: timestamp,
            format: 'json',
            v: '2.0',
            sign_method: 'md5',
            product_ids: sourceProductId,
            target_currency: 'USD'
          };
          const sign = generateTopSignature(apiParams, APP_SECRET);
          apiParams.sign = sign;

          const urlParams = new URLSearchParams(apiParams);
          const aliRes = await fetch(`https://api-sg.aliexpress.com/sync?${urlParams.toString()}`);
          if (aliRes.ok) {
            const aliData = await aliRes.json();
            const responseObj = aliData.aliexpress_affiliate_product_query_response;
            if (responseObj && responseObj.resp_result && responseObj.resp_result.result) {
              const productsObj = responseObj.resp_result.result.products;
              if (productsObj && productsObj.product) {
                const prod = Array.isArray(productsObj.product) ? productsObj.product[0] : productsObj.product;
                newPrice = prod.target_sale_price || prod.target_original_price || prod.app_sale_price;
              }
            }
          }
        }

        if (newPrice === null || newPrice === undefined) {
          return res.status(502).json({ error: 'Could not retrieve updated price from AliExpress API' });
        }

        const patchUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?id=eq.${id}`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            price: parseFloat(newPrice),
            updated_at: new Date().toISOString()
          })
        });

        if (!patchRes.ok) {
          return res.status(500).json({ error: 'Failed to update product price in database' });
        }

        return res.status(200).json({ success: true, updated_price: parseFloat(newPrice) });
      }

      // Normal edit (name_ar, description_ar, category, is_active)
      const updateFields = {};
      if (reqBody.name_ar !== undefined) updateFields.name_ar = reqBody.name_ar;
      if (reqBody.description_ar !== undefined) updateFields.description_ar = reqBody.description_ar;
      if (reqBody.category !== undefined) updateFields.category = reqBody.category;
      if (reqBody.is_active !== undefined) updateFields.is_active = Boolean(reqBody.is_active);
      updateFields.updated_at = new Date().toISOString();

      const patchUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?id=eq.${id}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateFields)
      });

      if (!patchRes.ok) {
        return res.status(500).json({ error: 'Failed to update product' });
      }

      return res.status(200).json({ success: true });

    } catch (err) {
      return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  }

  // 5. DELETE: Remove product from database
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || reqBody.id;
      if (!id) {
        return res.status(400).json({ error: 'Product ID is required' });
      }

      const deleteUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?id=eq.${id}`;
      const deleteRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      });

      if (!deleteRes.ok) {
        return res.status(500).json({ error: 'Failed to delete product' });
      }

      return res.status(200).json({ success: true });

    } catch (err) {
      return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
