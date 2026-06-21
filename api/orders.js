/**
 * Vercel API: /api/orders
 * مجمع لعمليات الطلبات، المسوقين، والتحكم الإداري.
 */

export default async function handler(req, res) {
  // 1. إعداد رؤوس CORS
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'http://localhost:3000',
    'https://zoona-git-feat-complete-affiliate-syste-30a731-sifians-projects.vercel.app',
    'https://zoona-git-feat-complete-affiliate-system-v2-30a731-sifians-projects.vercel.app'
  ];

  const isVercelPreview = origin.endsWith('.vercel.app') && origin.includes('sifians-projects');
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || isVercelPreview || !origin;

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 2. جلب متغيرات البيئة
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // 3. تحليل الطلب
  const method = req.method;
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { console.error('Failed to parse body:', e); }
  }
  const query = req.query || {};
  const data = { ...query, ...body };
  const { action, affiliateId, userId, id, orderId, password, adminPassword } = data;

  // 4. التحقق من الصلاحيات للعمليات الإدارية
  const adminActions = [
    'update_order_status',
    'update_payout_status',
    'save_product',
    'delete_product',
    'update_affiliate_status',
    'get_all_orders',
    'get_affiliates_stats'
  ];

  if (adminActions.includes(action)) {
    if (!ADMIN_PASSWORD || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'غير مصرح لك بالقيام بهذا الإجراء' });
    }
  }

  try {
    // 5. التحقق من النطاق المضيف (Security check)
    const host = req.headers.host || '';
    console.log(`[Request] Origin: ${origin}, Host: ${host}, Action: ${action}`);

    // التحقق من الآدمن (تسجيل الدخول)
    if (action === 'verify_admin') {
      if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة' });
    }

    // --- العمليات العامة (GET) ---
    if (method === 'GET') {
      // جلب طلبات المستخدم
      if (action === 'get_user_orders') {
        if (!userId) return res.status(400).json({ error: 'userId is required' });
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?user_id=eq.${userId}&select=*,order_products(*)&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const orders = await response.json();
        return res.status(200).json({ success: true, orders });
      }

      // جلب بيانات المسوق (لوحة المسوق)
      if (action === 'get_affiliate_data') {
        const affId = affiliateId || query.affiliateId;
        if (!affId) return res.status(400).json({ error: 'affiliateId is required' });

        // جلب بيانات المسوق
        const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users?affiliate_id=eq.${affId}&select=*`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const affData = await affRes.json();
        if (affData.length === 0) return res.status(404).json({ success: false, message: 'المسوق غير موجود' });

        // جلب الإحصائيات (نقرات)
        const clicksRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_tracking_clicks?affiliate_id=eq.${affId}&select=count`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
        });
        const totalClicks = clicksRes.headers.get('content-range')?.split('/')[1] || 0;

        // جلب الطلبات مع حالة العمولة
        const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affId}&select=status,order_id,total_amount,order_products(*)&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const orders = await ordersRes.json();

        // جلب العمولات المدفوعة
        const paidRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?affiliate_id=eq.${affId}&status=eq.paid&select=order_id`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const paidCommissions = await paidRes.json();
        const paidOrderIds = paidCommissions.map(c => c.order_id);

        const stats = {
          totalClicks: parseInt(totalClicks),
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => ['new', 'processing', 'pending'].includes(o.status)).length,
          confirmedOrders: orders.filter(o => ['delivered', 'completed', 'confirmed'].includes(o.status) && !paidOrderIds.includes(o.order_id)).length,
          cancelledOrders: orders.filter(o => o.status === 'cancelled').length
        };

        // جلب المنتجات المتاحة للعمولة
        const prodsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?commission=gt.0&status=eq.active&select=name,commission,image`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const products = await prodsRes.json();

        return res.status(200).json({ success: true, affiliate: affData[0], stats, products, paidOrderIds });
      }

      // جلب طلبات المسوق
      if (action === 'get_affiliate_orders' || (affiliateId && !action)) {
        const id = affiliateId || query.affiliateId;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${id}&select=*,order_products(*)&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const orders = await response.json();

        // إضافة حالة العمولة
        const paidRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?affiliate_id=eq.${id}&select=order_id,status`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const paidData = await paidRes.json();

        orders.forEach(o => {
          const commission = paidData.find(c => c.order_id === o.order_id);
          o.affiliate_status = commission ? commission.status : 'unpaid';
        });

        return res.status(200).json({ success: true, orders });
      }

      // جلب جميع الطلبات (للآدمن)
      if (action === 'get_all_orders') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*,order_products(*)&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const orders = await response.json();

        const affiliatesRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users?select=affiliate_id,name`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const affiliates = await affiliatesRes.json();

        const productsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,commission`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const products = await productsRes.json();

        // جلب حالة العمولة
        const commissionsRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?select=order_id,status`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const commissions = await commissionsRes.json();

        orders.forEach(o => {
          const comm = commissions.find(c => c.order_id === o.order_id);
          o.affiliate_status = comm ? comm.status : 'unpaid';
        });

        return res.status(200).json({ success: true, orders, affiliates, products });
      }

      // جلب إحصائيات المسوقين (للآدمن)
      if (action === 'get_affiliates_stats') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users?select=*&order=created_at.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const affiliates = await response.json();

        // إضافة عدد النقرات لكل مسوق
        for (let aff of affiliates) {
           const clicksRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_tracking_clicks?affiliate_id=eq.${aff.affiliate_id}&select=count`, {
             headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
           });
           aff.total_clicks = parseInt(clicksRes.headers.get('content-range')?.split('/')[1] || 0);
        }

        return res.status(200).json({ success: true, affiliates });
      }

      // جلب المنتجات (للآدمن)
      if (action === 'get_all_products') {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=id.desc`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const products = await response.json();
        return res.status(200).json({ success: true, products });
      }
    }

    // --- العمليات (POST/PATCH/DELETE) ---
    if (method === 'POST') {
      // إنشاء طلب جديد
      if (action === 'create_order' || (!action && body.orderId)) {
        const { orderId, userId, name, phone, phone2, city, cityType, shippingCost, total, address, location, products, affiliateId } = body;

        // 1. إضافة الطلب للجدول الرئيسي
        const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            order_id: orderId,
            user_id: userId,
            name,
            phone,
            phone2,
            city,
            city_type: cityType,
            shipping_cost: shippingCost,
            total_amount: total,
            address,
            location_link: location?.link,
            affiliate_id: affiliateId && affiliateId !== 'direct' ? affiliateId : null,
            status: 'new'
          })
        });

        if (!orderResponse.ok) {
          const err = await orderResponse.json();
          throw new Error(err.message || 'فشل حفظ الطلب');
        }
        const orderData = await orderResponse.json();

        // 2. إضافة المنتجات التابعة للطلب
        const orderProducts = products.map(p => ({
          order_id: orderId,
          product_id: p.id,
          product_name: p.name,
          quantity: p.quantity,
          price: p.price
        }));

        await fetch(`${SUPABASE_URL}/rest/v1/order_products`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderProducts)
        });

        return res.status(200).json({ success: true, message: 'تم استلام طلبك بنجاح', order: orderData[0] });
      }

      // تتبع نقرة المسوق
      if (action === 'track_affiliate_click' || action === 'track_click') {
        const { affiliateId, productName, trackingUrl } = body;
        await fetch(`${SUPABASE_URL}/rest/v1/affiliate_tracking_clicks`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            affiliate_id: affiliateId,
            product_name: productName || 'الصفحة الرئيسية',
            tracking_url: trackingUrl || origin
          })
        });
        return res.status(200).json({ success: true, message: 'تم تسجيل النقرة' });
      }

      // تسجيل مسوق جديد
      if (action === 'register_affiliate') {
        const { name, email, phone, password } = body;
        const affId = name.toLowerCase().replace(/\s+/g, '') + Math.floor(1000 + Math.random() * 9000);

        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            affiliate_id: affId,
            name,
            email,
            phone,
            password_hash: password,
            status: 'active'
          })
        });
        const data = await response.json();
        if (!response.ok) return res.status(400).json({ success: false, error: 'فشل التسجيل', details: data });
        return res.status(200).json({ success: true, affiliate: data[0] });
      }

      // تسجيل دخول مسوق
      if (action === 'login_affiliate') {
        const affId = (affiliateId || body.affiliateId || '').toLowerCase().trim();
        const pwd = password || body.password;

        console.log(`[Login] Attempt for: ${affId}`);

        const params = new URLSearchParams({
          affiliate_id: `eq.${affId}`,
          password_hash: `eq.${pwd}`,
          select: '*'
        });

        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users?${params.toString()}`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const data = await response.json();
        if (data.length > 0) {
          return res.status(200).json({ success: true, affiliate: data[0] });
        } else {
          return res.status(401).json({ success: false, message: 'المعرف أو كلمة المرور غير صحيحة' });
        }
      }

      // تحديث حالة الطلب (آدمن)
      if (action === 'update_order_status') {
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

        // إذا أصبحت الحالة "تم التوصيل"، نضمن وجود سجل في affiliate_commissions
        if (status === 'delivered' || status === 'completed') {
           const ordRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}&select=affiliate_id,total_amount,order_products(product_id,quantity)`, {
             headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
           });
           const ordData = await ordRes.json();
           if (ordData.length > 0 && ordData[0].affiliate_id) {
              const order = ordData[0];
              let totalComm = 0;

              // محاولة حساب العمولة الفعلية من المنتجات
              const productIds = order.order_products.map(p => p.product_id).filter(id => id);
              if (productIds.length > 0) {
                const prodsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=in.(${productIds.join(',')})&select=id,commission`, {
                  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const prodsData = await prodsRes.json();
                order.order_products.forEach(op => {
                  const p = prodsData.find(x => x.id === op.product_id);
                  if (p && p.commission) {
                    totalComm += p.commission * op.quantity;
                  }
                });
              }

              if (totalComm === 0) {
                totalComm = Math.round(order.total_amount * 0.05);
              }

              // إدراج أو تحديث العمولة
              await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions`, {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                  order_id: orderId,
                  affiliate_id: order.affiliate_id,
                  amount: totalComm,
                  status: 'unpaid'
                })
              });
           }
        }

        if (response.ok) return res.status(200).json({ success: true });
        return res.status(400).json({ success: false });
      }

      // تحديث حالة الدفع للعمولة (آدمن)
      if (action === 'update_payout_status') {
        const { orderId, status } = body; // status: 'paid' or 'unpaid'
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?order_id=eq.${orderId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        });
        if (response.ok) return res.status(200).json({ success: true });
        return res.status(400).json({ success: false });
      }

      // حفظ منتج (آدمن)
      if (action === 'save_product') {
        const prodData = { ...body };
        delete prodData.action;
        const prodId = prodData.id;
        delete prodData.id;

        let response;
        if (prodId) {
          response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${prodId}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ...prodData, updated_at: new Date().toISOString() })
          });
        } else {
          response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(prodData)
          });
        }
        if (response.ok) return res.status(200).json({ success: true });
        return res.status(400).json({ success: false });
      }

      // حذف منتج (آدمن)
      if (action === 'delete_product') {
        const { id } = body;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });
        if (response.ok) return res.status(200).json({ success: true });
        return res.status(400).json({ success: false });
      }

      // تحديث حالة المسوق (آدمن)
      if (action === 'update_affiliate_status') {
        const { affiliateId, status } = body;
        const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_users?affiliate_id=eq.${affiliateId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status, updated_at: new Date().toISOString() })
        });
        if (response.ok) return res.status(200).json({ success: true });
        return res.status(400).json({ success: false });
      }
    }

    return res.status(404).json({ error: 'Action not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
