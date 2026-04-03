// ================================================
// Vercel API - إدارة طلبات المستخدمين
// ================================================

const BIN_ID = '69336a3dae596e708f8650a1'; // نفس BIN المستخدمة في saveToken.js
const JSONBIN_KEY = '$2a$10$oHNml.lQOJitFfK0hyyT0.81SIcJolFR5be5uAAQ8IOiECZHAELTW';

export default async function handler(req, res) {
  const { action, userId } = req.query;

  // ================================================
  // GET_USER_ORDERS - جلب طلبات المستخدم
  // ================================================
  if (action === 'get_user_orders') {
    if (!userId) {
      return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب' });
    }

    try {
      // جلب جميع الطلبات من JSONBin
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });

      if (!getRes.ok) {
        throw new Error(`فشل في جلب البيانات: ${getRes.status}`);
      }

      const json = await getRes.json();
      
      // دعم البنية القديمة (tokens) والجديدة (orders)
      let allOrders = json.orders || [];
      
      // إذا لم توجد أوامر، ابحث في البنية القديمة
      if (allOrders.length === 0 && json.zoonaOrders) {
        allOrders = json.zoonaOrders;
      }
      const userOrders = allOrders.filter(order => 
        order.userId === userId || order.customer_id === userId
      );

      // ترتيب الطلبات حسب التاريخ (الأحدث أولاً)
      userOrders.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });

      return res.status(200).json({
        success: true,
        orders: userOrders,
        total: userOrders.length
      });

    } catch (err) {
      console.error('خطأ في جلب الطلبات:', err.message);
      return res.status(500).json({ 
        success: false, 
        error: 'خطأ في جلب الطلبات: ' + err.message 
      });
    }
  }

  // ================================================
  // GET_ORDER_DETAILS - جلب تفاصيل طلب واحد
  // ================================================
  if (action === 'get_order_details') {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'رقم الطلب مطلوب' });
    }

    try {
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });

      if (!getRes.ok) {
        throw new Error(`فشل في جلب البيانات: ${getRes.status}`);
      }

      const json = await getRes.json();
      const allOrders = json.orders || [];
      const order = allOrders.find(o => o.order_id === orderId);

      if (!order) {
        return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
      }

      return res.status(200).json({
        success: true,
        order: order
      });

    } catch (err) {
      console.error('خطأ في جلب تفاصيل الطلب:', err.message);
      return res.status(500).json({ 
        success: false, 
        error: 'خطأ في جلب تفاصيل الطلب: ' + err.message 
      });
    }
  }

  // ================================================
  // UPDATE_ORDER_STATUS - تحديث حالة الطلب
  // ================================================
  if (action === 'update_order_status' && req.method === 'POST') {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'رقم الطلب والحالة مطلوبان' });
    }

    try {
      // جلب البيانات الحالية
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });

      if (!getRes.ok) {
        throw new Error(`فشل في جلب البيانات: ${getRes.status}`);
      }

      const json = await getRes.json();
      let allOrders = json.orders || [];
      
      // البحث عن الطلب وتحديث حالته
      const orderIndex = allOrders.findIndex(o => o.order_id === orderId);
      
      if (orderIndex === -1) {
        return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
      }

      allOrders[orderIndex].status = status;
      allOrders[orderIndex].updated_at = new Date().toISOString();

      // حفظ البيانات المحدثة
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_KEY
        },
        body: JSON.stringify({ orders: allOrders })
      });

      if (!putRes.ok) {
        throw new Error(`فشل في تحديث البيانات: ${putRes.status}`);
      }

      return res.status(200).json({
        success: true,
        message: 'تم تحديث حالة الطلب بنجاح',
        order: allOrders[orderIndex]
      });

    } catch (err) {
      console.error('خطأ في تحديث حالة الطلب:', err.message);
      return res.status(500).json({ 
        success: false, 
        error: 'خطأ في تحديث حالة الطلب: ' + err.message 
      });
    }
  }

  // ================================================
  // DEFAULT - طريقة غير مسموحة
  // ================================================
  return res.status(405).json({ 
    success: false, 
    error: 'طريقة غير مسموحة' 
  });
}