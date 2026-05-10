/**
 * Vercel API: /api/orders
 * Centralized API for Affiliate System, Order Management, and Product CRUD.
 * Includes improved security and admin authentication.
 */

import crypto from 'crypto';

const ALLOWED_ORIGINS = [
  'https://zoonasd.com',
  'https://www.zoonasd.com',
  'https://zoona-git-professional-affiliate-system-892776-sifians-projects.vercel.app'
];

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  // 1. CORS Configuration
  const currentOrigin = req.headers.origin;
  if (currentOrigin && ALLOWED_ORIGINS.includes(currentOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Environment Variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ZoonaAdmin2024';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { action } = req.method === 'POST' ? req.body : req.query;
  const authHeader = req.headers.authorization;
  const isAdmin = authHeader === `Bearer ${ADMIN_PASSWORD}`;

  try {
    // --- AUTHENTICATION ACTIONS ---

    if (action === 'register_affiliate' && req.method === 'POST') {
      const { name, email, phone, password } = req.body;
      const namePart = name.trim().toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const affiliateId = `${namePart}${randomNum}`;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          affiliate_id: affiliateId,
          name,
          email,
          phone,
          password_hash: hashPassword(password),
          status: 'active'
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Registration failed');
      return res.status(200).json({ success: true, affiliate: result[0] });
    }

    if (action === 'login_affiliate' && req.method === 'POST') {
      const { affiliateId, password } = req.body;
      const hashedPassword = hashPassword(password);

      const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}&password_hash=eq.${hashedPassword}&select=*`, {
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });

      const data = await response.json();
      if (data.length > 0) {
        return res.status(200).json({ success: true, affiliate: data[0] });
      } else {
        return res.status(401).json({ success: false, message: 'معرف المسوق أو كلمة المرور غير صحيحة' });
      }
    }

    // --- TRACKING & ORDERS (Publicly Accessible) ---

    if (action === 'track_event' && req.method === 'POST') {
      const { affiliateId, eventType, productId, productName, metadata } = req.body;
      await fetch(`${SUPABASE_URL}/rest/v1/affiliate_events`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliate_id: affiliateId, event_type: eventType, product_id: productId, product_name: productName,
          metadata: metadata || {}, user_agent: req.headers['user-agent'],
          ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        })
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'create_order' && req.method === 'POST') {
      const orderData = req.body;
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderData.orderId,
          user_id: orderData.userId,
          affiliate_id: orderData.affiliateId,
          name: orderData.name,
          phone: orderData.phone,
          phone2: orderData.phone2,
          city: orderData.city,
          city_type: orderData.cityType,
          shipping_cost: orderData.shippingCost,
          total_amount: orderData.total,
          address: orderData.address,
          location_link: orderData.location ? orderData.location.link : null,
          order_products: orderData.products,
          status: 'new'
        })
      });
      if (!response.ok) throw new Error('Failed to create order');
      return res.status(200).json({ success: true });
    }

    // --- ADMIN ACTIONS (Protected) ---

    if (!isAdmin) {
      const adminActions = ['get_all_orders', 'update_order_status', 'get_affiliates_stats', 'update_affiliate_status', 'get_all_products', 'admin_product_crud'];
      if (adminActions.includes(action)) return res.status(403).json({ error: 'Unauthorized' });
    }

    if (action === 'get_all_orders' && req.method === 'GET') {
      const [ordersRes, affiliatesRes, productsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } })
      ]);
      return res.status(200).json({ success: true, orders: await ordersRes.json(), affiliates: await affiliatesRes.json(), products: await productsRes.json() });
    }

    if (action === 'update_order_status' && req.method === 'POST') {
      const { orderId, status } = req.body;
      await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'get_affiliate_data' && req.method === 'GET') {
      const { affiliateId } = req.query;
      const [affRes, clicksRes, ordersRes, productsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}&select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/affiliate_events?affiliate_id=eq.${affiliateId}&event_type=eq.click&select=id`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affiliateId}&select=status`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
        fetch(`${SUPABASE_URL}/rest/v1/products?commission=gt.0&select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } })
      ]);
      const affData = await affRes.json();
      if (affData.length === 0) throw new Error('Affiliate not found');
      const clicks = await clicksRes.json();
      const orders = await ordersRes.json();
      return res.status(200).json({
        success: true, affiliate: affData[0],
        stats: { totalClicks: clicks.length, totalOrders: orders.length, confirmedOrders: orders.filter(o => o.status === 'delivered').length },
        products: await productsRes.json()
      });
    }

    if (action === 'get_affiliates_stats' && req.method === 'GET') {
      const affiliatesRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
      const affiliates = await affiliatesRes.json();
      const statsPromises = affiliates.map(async (aff) => {
        const clicksRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_events?affiliate_id=eq.${aff.affiliate_id}&event_type=eq.click&select=id`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        const clicks = await clicksRes.json();
        return { ...aff, total_clicks: clicks.length };
      });
      return res.status(200).json({ success: true, affiliates: await Promise.all(statsPromises) });
    }

    if (action === 'get_all_products' && req.method === 'GET') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
      return res.status(200).json({ success: true, products: await response.json() });
    }

    if (action === 'admin_product_crud' && req.method === 'POST') {
      const { method, id, data } = req.body;
      console.log(`[admin_product_crud] Method: ${method}, ID: ${id}, Data:`, JSON.stringify(data));

      let response;
      if (method === 'POST') {
        // Validation: Ensure required fields are present for new products
        if (!data || !data.name) throw new Error('Missing product name');

        response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            name: data.name,
            url: data.url,
            commission: Number(data.commission) || 0,
            status: data.status || 'active'
          })
        });
      } else if (method === 'PATCH') {
        if (!id) throw new Error('Missing product ID for update');

        // Prepare update object with only provided fields
        const updateData = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.url !== undefined) updateData.url = data.url;
        if (data.commission !== undefined) updateData.commission = Number(data.commission) || 0;
        if (data.status !== undefined) updateData.status = data.status;

        response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
      } else if (method === 'DELETE') {
        if (!id) throw new Error('Missing product ID for deletion');
        response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
      } else {
        throw new Error(`Invalid method: ${method}`);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[admin_product_crud] Supabase Error:`, response.status, errorBody);
        let errorMessage = 'Product operation failed';
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = errorBody || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Supabase returns 204 No Content for successful PATCH/DELETE by default
      let result = { success: true };
      if (response.status !== 204) {
        try {
          result = await response.json();
        } catch (e) {
          console.warn(`[admin_product_crud] Failed to parse response JSON:`, e.message);
        }
      }

      console.log(`[admin_product_crud] Success:`, result);
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error(`[API Orders] Error:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
