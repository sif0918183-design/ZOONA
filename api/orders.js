import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * Vercel API: /api/orders
 * واجهة برمجية موحدة لإدارة الطلبات، المسوقين، وتتبع النقرات.
 * تحل محل البروكسي الخارجي وتستخدم مفاتيح Supabase من متغيرات البيئة.
 */

// إعدادات النطاقات المسموحة
const ALLOWED_ORIGINS = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'http://localhost:3000',
    'https://orders-9vxn.vercel.app',
    'https://zoonaza.vercel.app',
    'https://zoona-git-fix-affiliate-tracking-system-3aafe9-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-marketing-syste-10e4dc-sifians-projects.vercel.app',
    'https://zoona-git-feature-affiliate-tracking-in-16c497-sifians-projects.vercel.app',
    'https://zoona-git-feature-affiliate-tracking-12-83b8b3-sifians-projects.vercel.app',
    'https://zoona-git-feature-out-of-stock-indicato-6a745f-sifians-projects.vercel.app'
];

const ALLOWED_HOSTS = [
    'zoonasd.com',
    'www.zoonasd.com',
    'localhost:3000',
    'orders-9vxn.vercel.app',
    'zoonaza.vercel.app'
];

function checkAllowedOrigin(req) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';

    if (!origin && !referer) return false;

    const source = origin || referer;
    return ALLOWED_ORIGINS.some(allowed => source.startsWith(allowed));
}

function checkAllowedHost(req) {
    const host = req.headers.host || '';
    return ALLOWED_HOSTS.some(allowed => host.includes(allowed)) || host.endsWith('.vercel.app');
}

// دالة لتشفير كلمة المرور
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
    // التحقق من صلاحية المصدر (CORS)
    const isOriginAllowed = checkAllowedOrigin(req);
    const isHostAllowed = checkAllowedHost(req);

    if (!isOriginAllowed && !isHostAllowed) {
        console.log('🚫 محاولة وصول غير مصرح بها:', {
            origin: req.headers.origin,
            referer: req.headers.referer,
            host: req.headers.host
        });
        return res.status(403).json({ error: 'الوصول مرفوض' });
    }

    // إعداد رؤوس CORS
    const origin = req.headers.origin || 'https://zoonasd.com';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'إعدادات Supabase مفقودة' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // --- معالجة طلبات POST ---
        if (req.method === 'POST') {
            if (!req.body) {
                return res.status(400).json({ error: 'طلب بدون بيانات' });
            }

            const body = req.body;
            const action = body.action;

            // تسجيل النقرات
            if (action === 'track_click' || action === 'track_affiliate_click') {
                const { affiliateId, productName, trackingUrl } = body;
                if (!affiliateId || affiliateId === 'direct') {
                    return res.status(200).json({ success: true, message: 'زيارة مباشرة' });
                }

                await supabase.from('affiliate_tracking_clicks').insert([{
                    affiliate_id: affiliateId,
                    product_name: productName || 'غير معروف',
                    tracking_url: trackingUrl || '',
                    click_type: 'direct',
                    created_at: new Date().toISOString()
                }]);

                await updateAffiliateStats(supabase, affiliateId);
                return res.status(200).json({ success: true, message: 'تم تسجيل النقرة' });
            }

            // إنشاء طلب جديد (الافتراضي إذا لم يتم تحديد إجراء)
            if (!action || action === 'create_order') {
                const { orderId, userId, name, phone, phone2, city, cityType, shippingCost, total, address, location, products, affiliateId } = body;

                if (!orderId || !userId || !name || !phone) {
                    return res.status(400).json({ error: 'بيانات الطلب ناقصة' });
                }

                const { error: orderError } = await supabase.from('orders').insert([{
                    order_id: orderId,
                    user_id: userId,
                    name,
                    phone,
                    phone2: phone2 || null,
                    city,
                    city_type: cityType,
                    shipping_cost: shippingCost || 0,
                    total_amount: total,
                    address,
                    location_link: location ? (typeof location === 'string' ? location : location.link) : null,
                    payment_type: cityType === 'cod' ? 'دفع عند الاستلام' : 'دفع مقدم',
                    affiliate_id: affiliateId || 'direct',
                    status: 'new',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

                if (orderError) throw orderError;

                if (products && products.length > 0) {
                    const orderProducts = products.map(p => ({
                        order_id: orderId,
                        product_id: p.id,
                        product_name: p.name,
                        quantity: p.quantity,
                        price: p.price,
                        warehouse: p.warehouse,
                        created_at: new Date().toISOString()
                    }));
                    await supabase.from('order_products').insert(orderProducts);
                }

                // تسجيل بيانات العمولة للمسوق
                if (affiliateId && affiliateId !== 'direct') {
                    const commission = Math.round(total * 0.05);
                    await supabase.from('affiliate_orders').insert([{
                        affiliate_id: affiliateId,
                        order_id: orderId,
                        commission: commission,
                        commission_rate: '5%',
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }]);
                    await updateAffiliateStats(supabase, affiliateId);
                }

                return res.status(200).json({ success: true, orderId, message: 'تم إنشاء الطلب بنجاح' });
            }

            // تسجيل مسوق جديد
            if (action === 'register_affiliate') {
                const { name, email, phone, password } = body;
                const affiliateId = generateAffiliateId(name);
                const hashedPassword = hashPassword(password);

                const { data, error } = await supabase.from('affiliate_users').insert([{
                    affiliate_id: affiliateId,
                    name,
                    email,
                    phone,
                    password: hashedPassword,
                    status: 'active',
                    total_clicks: 0,
                    total_orders: 0,
                    registration_date: new Date().toISOString()
                }]).select().single();

                if (error) throw error;
                return res.status(200).json({ success: true, affiliate: data });
            }

            // تسجيل دخول المسوق
            if (action === 'login_affiliate') {
                const { affiliateId, password } = body;
                const hashedPassword = hashPassword(password);

                const { data, error } = await supabase.from('affiliate_users')
                    .select('*')
                    .eq('affiliate_id', affiliateId)
                    .eq('password', hashedPassword)
                    .single();

                if (error || !data) {
                    return res.status(401).json({ success: false, message: 'المعرف أو كلمة المرور غير صحيحة' });
                }
                return res.status(200).json({ success: true, affiliate: data });
            }

            // تحديث حالة الطلب
            if (action === 'update_order_status') {
                const { orderId, status } = body;
                const { error } = await supabase.from('orders')
                    .update({ status, updated_at: new Date().toISOString() })
                    .eq('order_id', orderId);

                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            // تحديث حالة المسوق
            if (action === 'update_affiliate_status') {
                const { affiliateId, status } = body;
                const { error } = await supabase.from('affiliate_users')
                    .update({ status })
                    .eq('affiliate_id', affiliateId);

                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            // حفظ أو تعديل منتج
            if (action === 'save_product') {
                const { id, name, url, commission, status } = body;
                const productData = {
                    name,
                    url,
                    commission: parseInt(commission),
                    status,
                    updated_at: new Date().toISOString()
                };

                let err;
                if (id) {
                    const { error: updateError } = await supabase.from('affiliate_products')
                        .update(productData)
                        .eq('id', id);
                    err = updateError;
                } else {
                    const { error: insertError } = await supabase.from('affiliate_products')
                        .insert([{ ...productData, created_at: new Date().toISOString() }]);
                    err = insertError;
                }

                if (err) throw err;
                return res.status(200).json({ success: true });
            }

            // حذف منتج
            if (action === 'delete_product') {
                const { id } = body;
                const { error } = await supabase.from('affiliate_products').delete().eq('id', id);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }
        }

        // --- معالجة طلبات GET ---
        if (req.method === 'GET') {
            const { action, affiliateId, orderId, userId } = req.query;

            // جلب جميع الطلبات للوحة التحكم
            if (action === 'get_all_orders') {
                const { data: orders, error: ordersError } = await supabase
                    .from('orders')
                    .select('*, order_products(*)')
                    .order('created_at', { ascending: false });

                if (ordersError) throw ordersError;

                const { data: affiliates } = await supabase.from('affiliate_users').select('affiliate_id, name');
                const { data: affProducts } = await supabase.from('affiliate_products').select('*');

                return res.status(200).json({
                    success: true,
                    orders,
                    affiliates: affiliates || [],
                    products: affProducts || []
                });
            }

            // جلب إحصائيات المسوقين
            if (action === 'get_affiliates_stats') {
                const { data, error } = await supabase.from('affiliate_users').select('*').order('registration_date', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, affiliates: data });
            }

            // جلب بيانات مسوق محدد
            if (action === 'get_affiliate_data') {
                const { data: affiliate, error } = await supabase.from('affiliate_users').select('*').eq('affiliate_id', affiliateId).single();
                if (error) throw error;

                const { data: products } = await supabase.from('affiliate_products').select('*').eq('status', 'active');

                // جلب إحصائيات الطلبات بكفاءة
                const { data: orders } = await supabase.from('orders').select('status').eq('affiliate_id', affiliateId);
                const stats = {
                    totalClicks: affiliate.total_clicks || 0,
                    totalOrders: orders ? orders.length : 0,
                    pendingOrders: orders ? orders.filter(o => o.status === 'new' || o.status === 'processing').length : 0,
                    confirmedOrders: orders ? orders.filter(o => o.status === 'delivered' || o.status === 'shipped' || o.status === 'completed' || o.status === 'تم التوصيل' || o.status === 'مكتمل').length : 0,
                    cancelledOrders: orders ? orders.filter(o => o.status === 'cancelled').length : 0
                };

                return res.status(200).json({ success: true, affiliate, products: products || [], stats });
            }

            // جلب جميع المنتجات
            if (action === 'get_all_products') {
                const { data, error } = await supabase.from('affiliate_products').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, products: data });
            }

            // جلب طلبات مستخدم محدد
            if (action === 'get_user_orders' || userId) {
                const uid = userId || req.query.userId;
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('*, order_products(*)')
                    .eq('user_id', uid)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return res.status(200).json({ success: true, orders });
            }

            // جلب طلبات المسوق (الافتراضي لطلب GET مع معرف المسوق)
            if (affiliateId || action === 'get_affiliate_orders') {
                const { data: orders, error: ordersError } = await supabase
                    .from('orders')
                    .select('*, order_products(*)')
                    .eq('affiliate_id', affiliateId)
                    .order('created_at', { ascending: false });
                if (ordersError) throw ordersError;

                return res.status(200).json({ success: true, orders });
            }

            // جلب تفاصيل طلب محدد
            if (orderId) {
                const { data, error } = await supabase.from('orders').select('*, order_products(*)').eq('order_id', orderId).single();
                if (error) throw error;
                return res.status(200).json({ success: true, order: data });
            }
        }

        return res.status(405).json({ error: 'الطريقة غير مسموحة' });

    } catch (error) {
        console.error('خطأ في واجهة البرمجة:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// --- دوال مساعدة ---

// تحديث إحصائيات المسوق
async function updateAffiliateStats(supabase, affiliateId) {
    try {
        // التحقق من وجود المسوق أولاً
        const { data: affiliateExists } = await supabase
            .from('affiliate_users')
            .select('affiliate_id')
            .eq('affiliate_id', affiliateId)
            .single();

        if (!affiliateExists) {
            console.log('⚠️ المسوق غير موجود:', affiliateId);
            return;
        }

        const { count: clicks } = await supabase.from('affiliate_tracking_clicks').select('*', { count: 'exact', head: true }).eq('affiliate_id', affiliateId);
        const { count: orders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('affiliate_id', affiliateId);

        await supabase.from('affiliate_users').update({
            total_clicks: clicks || 0,
            total_orders: orders || 0,
            last_updated: new Date().toISOString()
        }).eq('affiliate_id', affiliateId);
    } catch (e) {
        console.error('Error updating stats:', e);
    }
}

// توليد معرف للمسوق
function generateAffiliateId(name) {
    // استخراج الاسم الأول بالإنجليزية أو استخدامه كبادئة
    let namePart = (name || '').trim().toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');

    // إذا كان الاسم فارغاً أو عربياً بالكامل، نستخدم بادئة افتراضية
    if (!namePart) namePart = 'user';

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return namePart + randomNum;
}
