/**
 * Vercel API: /api/orders
 * المركز الرئيسي لإدارة الطلبات، المسوقين، والعمولات.
 */

export default async function handler(req, res) {
  // 1. إعداد رؤوس CORS
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-fix-affiliate-marketing-syste-10e4dc-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || !origin;

  if (origin && !isAllowed) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. جلب متغيرات البيئة
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }

  // 3. تحليل جسم الطلب (Body)
  let body = {};
  if (req.method === 'POST' || req.method === 'PATCH') {
    if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch (e) { body = {}; }
    } else {
      body = req.body || {};
    }
  }

  const action = req.query.action || body.action;
  const effectiveAction = action || (req.method === 'GET' ? (req.query.affiliateId ? 'get_affiliate_orders' : 'get_all_orders') : '');

  try {
    switch (effectiveAction) {
      // ─── مسار المسوقين ───

      case 'register_affiliate': {
        const { name, email, phone, password } = body;
        // توليد معرف مسوق فريد
        const affiliateId = name.toLowerCase().replace(/\s+/g, '') + Math.floor(1000 + Math.random() * 9000);

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
            password, // في نظام الإنتاج يجب تشفيرها
            status: 'active',
            total_clicks: 0,
            registration_date: new Date().toISOString()
          })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return res.status(201).json({ success: true, affiliate: data[0] });
      }

      case 'login_affiliate': {
        const { affiliateId, password } = body;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}&password=eq.${password}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        if (data.length === 0) return res.status(401).json({ success: false, message: 'معرف المسوق أو كلمة المرور غير صحيحة' });
        return res.status(200).json({ success: true, affiliate: data[0] });
      }

      case 'track_click':
      case 'track_affiliate_click': {
        const affId = body.affiliateId || req.query.affiliateId;
        if (!affId || affId === 'direct') return res.status(200).json({ success: true, message: 'Direct visit' });

        // 1. تسجيل النقرة في جدول affiliate_clicks
        await fetch(`${SUPABASE_URL}/rest/v1/affiliate_clicks`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            affiliate_id: affId,
            product_name: body.productName || 'الرئيسية',
            tracking_url: body.trackingUrl || '',
            created_at: new Date().toISOString()
          })
        });

        // 2. تحديث عداد النقرات في جدول affiliates
        // جلب العدد الحالي أولاً
        const getAff = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affId}&select=total_clicks`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const affData = await getAff.json();
        if (affData.length > 0) {
          const newClicks = (affData[0].total_clicks || 0) + 1;
          await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affId}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ total_clicks: newClicks })
          });
        }

        return res.status(200).json({ success: true, message: 'Click tracked' });
      }

      case 'get_affiliate_data': {
        const affId = req.query.affiliateId;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affId}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        if (data.length === 0) return res.status(404).json({ success: false, message: 'المسوق غير موجود' });

        // جلب المنتجات المتاحة للتسويق (من جدول products)
        const productsResp = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,commission,id`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const products = await productsResp.json();

        // جلب ملخص الطلبات
        const ordersResp = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affId}&select=status`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const ordersData = await ordersResp.json();

        const stats = {
          totalClicks: data[0].total_clicks || 0,
          totalOrders: ordersData.length,
          pendingOrders: ordersData.filter(o => ['new', 'processing', 'pending'].includes(o.status)).length,
          confirmedOrders: ordersData.filter(o => ['delivered', 'completed', 'confirmed'].includes(o.status)).length,
          cancelledOrders: ordersData.filter(o => o.status === 'cancelled').length
        };

        return res.status(200).json({ success: true, affiliate: data[0], stats, products });
      }

      // ─── مسار الطلبات ───

      case 'create_order': {
        const orderData = {
          order_id: body.orderId,
          user_id: body.userId,
          name: body.name,
          phone: body.phone,
          phone2: body.phone2,
          city: body.city,
          city_type: body.cityType,
          shipping_cost: body.shippingCost,
          total_amount: body.total,
          address: body.address,
          location_data: body.location, // JSON
          order_products: body.products, // JSON
          affiliate_id: body.affiliateId || 'direct',
          status: 'new',
          affiliate_status: 'unpaid',
          created_at: new Date().toISOString()
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error(await response.text());
        return res.status(201).json({ success: true, message: 'Order created successfully' });
      }

      case 'get_affiliate_orders': {
        const affId = req.query.affiliateId;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affId}&select=*&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        return res.status(200).json({ success: true, orders: data });
      }

      case 'get_user_orders': {
        const uId = req.query.userId;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?user_id=eq.${uId}&select=*&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        return res.status(200).json({ success: true, orders: data });
      }

      // ─── مسار الإدارة (Admin) ───

      case 'get_all_orders': {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const orders = await response.json();

        const affResp = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=affiliate_id,name`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const affiliates = await affResp.json();

        const prodResp = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,commission`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const products = await prodResp.json();

        return res.status(200).json({ success: true, orders, affiliates, products });
      }

      case 'get_affiliates_stats': {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=*&order=registration_date.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        return res.status(200).json({ success: true, affiliates: data });
      }

      case 'update_order_status': {
        const { orderId, status } = body;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        });
        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ success: true });
      }

      case 'update_commission_payment': {
        const { orderId, affiliateStatus } = body; // affiliateStatus: 'paid' or 'unpaid'
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ affiliate_status: affiliateStatus, updated_at: new Date().toISOString() })
        });
        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ success: true });
      }

      case 'update_affiliate_status': {
        // This is for toggling affiliate account status (active/inactive)
        const { affiliateId, status } = body;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status })
        });
        if (!response.ok) throw new Error(await response.text());
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: `Action ${effectiveAction} not supported` });
    }
  } catch (error) {
    console.error(`[Orders API] Error in ${effectiveAction}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
