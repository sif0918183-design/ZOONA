/**
 * Vercel API: /api/orders
 * Centralized backend for orders and affiliate management.
 */

const crypto = require('crypto');

// Utility for hashing passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  // CORS Configuration
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-fix-affiliate-tracking-system-3aafe9-sifians-projects.vercel.app'
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow for direct testing
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }

  const { action, affiliateId, userId, orderId, password, status, id } = req.query;
  const body = req.body;

  try {
    // ═══════════════════════════════════════════
    // ACTION: track_affiliate_click
    // ═══════════════════════════════════════════
    if (action === 'track_affiliate_click' || (req.method === 'POST' && body.action === 'track_affiliate_click')) {
      const affId = affiliateId || body.affiliateId;
      if (!affId) return res.status(400).json({ error: 'affiliateId required' });

      // 1. Log event
      await fetch(`${SUPABASE_URL}/rest/v1/affiliate_events`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliate_id: affId,
          event_type: 'click',
          product_name: body.productName || 'landing_page',
          tracking_url: body.trackingUrl || '',
          user_agent: req.headers['user-agent']
        })
      });

      // 2. Increment click count in affiliates table
      // We first fetch current count then update
      const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affId}&select=total_clicks`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const affData = await affRes.json();

      if (affData.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ total_clicks: (affData[0].total_clicks || 0) + 1 })
        });
      }

      return res.status(200).json({ success: true, message: 'Click tracked' });
    }

    // ═══════════════════════════════════════════
    // ACTION: create_order
    // ═══════════════════════════════════════════
    if (action === 'create_order' || (req.method === 'POST' && body.action === 'create_order')) {
      const orderData = body;

      // 1. Insert order
      const orderRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          order_id: orderData.orderId,
          user_id: orderData.userId,
          name: orderData.name,
          phone: orderData.phone,
          phone2: orderData.phone2,
          city: orderData.city,
          city_type: orderData.cityType,
          shipping_cost: orderData.shippingCost,
          total_amount: orderData.total,
          address: orderData.address,
          location_lat: orderData.location ? orderData.location.lat : null,
          location_lng: orderData.location ? orderData.location.lng : null,
          location_link: orderData.location ? orderData.location.link : null,
          payment_type: orderData.cityType === 'cod' ? 'دفع عند الاستلام' : 'دفع مقدم',
          affiliate_id: orderData.affiliateId || 'direct',
          status: 'new'
        })
      });

      if (!orderRes.ok) {
        const err = await orderRes.text();
        throw new Error('Failed to insert order: ' + err);
      }

      // 2. Insert products
      if (orderData.products && orderData.products.length > 0) {
        const productsToInsert = orderData.products.map(p => ({
          order_id: orderData.orderId,
          product_id: p.id.toString(),
          product_name: p.name,
          quantity: p.quantity,
          price: p.price,
          warehouse: p.warehouse
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/order_products`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(productsToInsert)
        });
      }

      return res.status(200).json({ success: true, message: 'Order created successfully' });
    }

    // ═══════════════════════════════════════════
    // ACTION: get_affiliate_data (For Dashboard)
    // ═══════════════════════════════════════════
    if (action === 'get_affiliate_data') {
      if (!affiliateId) return res.status(400).json({ error: 'affiliateId required' });

      // Fetch affiliate
      const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const affData = await affRes.json();
      if (affData.length === 0) return res.status(404).json({ success: false, message: 'Affiliate not found' });

      // Fetch orders to calculate stats
      const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affiliateId}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const ordersData = await ordersRes.json();

      // Fetch products for listing in dash
      const productsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,commission,image,category&status=eq.active`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const productsData = await productsRes.json();

      const stats = {
        totalClicks: affData[0].total_clicks || 0,
        totalOrders: ordersData.length,
        pendingOrders: ordersData.filter(o => ['new', 'processing', 'pending'].includes(o.status)).length,
        confirmedOrders: ordersData.filter(o => ['delivered', 'confirmed'].includes(o.status)).length,
        cancelledOrders: ordersData.filter(o => o.status === 'cancelled').length
      };

      return res.status(200).json({
        success: true,
        affiliate: affData[0],
        stats,
        products: productsData
      });
    }

    // ═══════════════════════════════════════════
    // ACTION: get_affiliate_orders
    // ═══════════════════════════════════════════
    if (action === 'get_affiliate_orders' || (req.method === 'GET' && affiliateId && !action)) {
      const affId = affiliateId;
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affId}&select=*,order_products(*)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      return res.status(200).json({ success: true, orders: data });
    }

    // ═══════════════════════════════════════════
    // ACTION: get_user_orders (For users tracking their own orders)
    // ═══════════════════════════════════════════
    if (action === 'get_user_orders') {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?user_id=eq.${userId}&select=*,order_products(*)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const data = await response.json();
      // Map products for index.html compatibility
      const orders = data.map(o => ({
        ...o,
        products: o.order_products
      }));
      return res.status(200).json({ success: true, orders });
    }

    // ═══════════════════════════════════════════
    // ACTION: get_all_orders (Admin)
    // ═══════════════════════════════════════════
    if (action === 'get_all_orders') {
      const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*,order_products(*)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const orders = await ordersRes.json();

      const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=affiliate_id,name`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const affiliates = await affRes.json();

      const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,commission`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const products = await prodRes.json();

      return res.status(200).json({ success: true, orders, affiliates, products });
    }

    // ═══════════════════════════════════════════
    // ACTION: register_affiliate
    // ═══════════════════════════════════════════
    if (action === 'register_affiliate' || (req.method === 'POST' && body.action === 'register_affiliate')) {
      const data = body.action === 'register_affiliate' ? body : body;

      // Generate ID
      const namePart = data.name.trim().toLowerCase().replace(/\s+/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const generatedId = namePart + randomNum;

      const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/affiliates`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          affiliate_id: generatedId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          password_hash: hashPassword(data.password),
          status: 'active'
        })
      });

      if (!resInsert.ok) {
        const err = await resInsert.text();
        return res.status(400).json({ success: false, error: 'Registration failed', details: err });
      }

      const aff = await resInsert.json();
      return res.status(200).json({ success: true, affiliate: aff[0] });
    }

    // ═══════════════════════════════════════════
    // ACTION: login_affiliate
    // ═══════════════════════════════════════════
    if (action === 'login_affiliate' || (req.method === 'POST' && body.action === 'login_affiliate')) {
      const { affiliateId, password } = body;
      const resAff = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}&select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const dataAff = await resAff.json();

      if (dataAff.length === 0 || dataAff[0].password_hash !== hashPassword(password)) {
        return res.status(401).json({ success: false, message: 'Invalid ID or password' });
      }

      return res.status(200).json({ success: true, affiliate: dataAff[0] });
    }

    // ═══════════════════════════════════════════
    // ACTION: update_order_status
    // ═══════════════════════════════════════════
    if (action === 'update_order_status' || (req.method === 'POST' && body.action === 'update_order_status')) {
      const oId = orderId || body.orderId;
      const newStatus = status || body.status;

      const resUpdate = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${oId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, updated_at: new Date().toISOString() })
      });

      if (!resUpdate.ok) return res.status(500).json({ success: false, error: 'Update failed' });
      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════════
    // ACTION: update_affiliate_status (Commission Payout)
    // ═══════════════════════════════════════════
    if (action === 'update_affiliate_status' || (req.method === 'POST' && body.action === 'update_affiliate_status')) {
      const oId = orderId || body.orderId;
      const newAffStatus = status || body.status; // 'paid' or 'pending'

      const resUpdate = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${oId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliate_status: newAffStatus, updated_at: new Date().toISOString() })
      });

      if (!resUpdate.ok) return res.status(500).json({ success: false, error: 'Update failed' });
      return res.status(200).json({ success: true });
    }

    // ═══════════════════════════════════════════
    // Admin Products (Minimal subset for dashboard)
    // ═══════════════════════════════════════════
    if (action === 'get_all_products') {
      const resP = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=id.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
      const dataP = await resP.json();
      return res.status(200).json({ success: true, products: dataP });
    }

    return res.status(400).json({ error: 'Invalid action' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
}
