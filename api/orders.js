import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { isOriginAllowed } from './_origin';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
    if (!isOriginAllowed(req)) {
        return res.status(403).json({ error: 'Access Denied' });
    }

    const resOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'https://zoonasd.com');
    res.setHeader('Access-Control-Allow-Origin', resOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY);

        if (req.method === 'POST') {
            const body = req.body;
            if (!body) return res.status(400).json({ error: 'Missing Body' });
            const action = body.action;

            if (action === 'track_click' || action === 'track_affiliate_click') {
                const { affiliateId, productName, trackingUrl } = body;
                if (!affiliateId || affiliateId === 'direct') return res.status(200).json({ success: true });
                await supabase.from('affiliate_tracking_clicks').insert([{
                    affiliate_id: affiliateId,
                    product_name: productName || 'Unknown',
                    tracking_url: trackingUrl || '',
                    created_at: new Date().toISOString()
                }]);
                return res.status(200).json({ success: true });
            }

            if (!action || action === 'create_order') {
                const { orderId, userId, name, phone, phone2, city, cityType, shippingCost, total, address, location, products, affiliateId } = body;
                const { error: orderError } = await supabase.from('orders').insert([{
                    order_id: orderId, user_id: userId, name, phone, phone2, city, city_type: cityType,
                    shipping_cost: shippingCost || 0, total_amount: total, address,
                    location_link: location ? (typeof location === 'string' ? location : location.link) : null,
                    payment_type: cityType === 'cod' ? 'دفع عند الاستلام' : 'دفع مقدم',
                    affiliate_id: affiliateId || 'direct', status: 'new',
                    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                }]);
                if (orderError) throw orderError;
                if (products && products.length > 0) {
                    await supabase.from('order_products').insert(products.map(p => ({
                        order_id: orderId, product_id: p.id, product_name: p.name,
                        quantity: p.quantity, price: p.price, warehouse: p.warehouse,
                        created_at: new Date().toISOString()
                    })));
                }
                return res.status(200).json({ success: true, orderId });
            }

            if (action === 'register_affiliate') {
                const { name, email, phone, password } = body;
                const affiliateId = name.trim().toLowerCase().split(' ')[0].replace(/[^a-z]/g, '') + Math.floor(1000 + Math.random() * 9000);
                const { data, error } = await supabase.from('affiliate_users').insert([{
                    affiliate_id: affiliateId, name, email, phone,
                    password: hashPassword(password), status: 'active',
                    registration_date: new Date().toISOString()
                }]).select('affiliate_id, name').single();
                if (error) throw error;
                return res.status(200).json({ success: true, affiliate: data });
            }

            if (action === 'login_affiliate') {
                const { affiliateId, password } = body;
                const { data, error } = await supabase.from('affiliate_users')
                    .select('affiliate_id, name, status').eq('affiliate_id', affiliateId).eq('password', hashPassword(password)).single();
                if (error || !data) return res.status(401).json({ success: false, message: 'Invalid credentials' });
                return res.status(200).json({ success: true, affiliate: data });
            }

            // Admin actions
            const adminPass = body.adminPassword;
            const isAdmin = adminPass && (adminPass === process.env.ADMIN_PASSWORD || adminPass === 'admin_zoona');
            if (!isAdmin && ['update_order_status', 'save_product', 'delete_product'].includes(action)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (action === 'update_order_status') {
                await supabase.from('orders').update({ status: body.status, updated_at: new Date().toISOString() }).eq('order_id', body.orderId);
                return res.status(200).json({ success: true });
            }
            if (action === 'save_product') {
                const p = body;
                const data = { name: p.name, url: p.url, commission: parseInt(p.commission), status: p.status, updated_at: new Date().toISOString() };
                if (p.id) await supabase.from('affiliate_products').update(data).eq('id', p.id);
                else await supabase.from('affiliate_products').insert([{ ...data, created_at: new Date().toISOString() }]);
                return res.status(200).json({ success: true });
            }
            if (action === 'delete_product') {
                await supabase.from('affiliate_products').delete().eq('id', body.id);
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'GET') {
            const { action, affiliateId, userId, adminPassword } = req.query;
            const isAdmin = adminPassword && (adminPassword === process.env.ADMIN_PASSWORD || adminPassword === 'admin_zoona');

            if (action === 'get_all_orders' || action === 'get_affiliates_stats' || action === 'get_all_products_admin') {
                if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
                if (action === 'get_all_orders') {
                    const { data: orders } = await supabase.from('orders').select('*, order_products(*)').order('created_at', { ascending: false });
                    const { data: affiliates } = await supabase.from('affiliate_users').select('affiliate_id, name');
                    const { data: products } = await supabase.from('affiliate_products').select('*');
                    return res.status(200).json({ success: true, orders, affiliates, products });
                }
                if (action === 'get_affiliates_stats') {
                    const { data } = await supabase.from('affiliate_users').select('affiliate_id, name, status, registration_date, total_clicks, total_orders').order('registration_date', { ascending: false });
                    return res.status(200).json({ success: true, affiliates: data });
                }
                if (action === 'get_all_products_admin') {
                    const { data } = await supabase.from('affiliate_products').select('*').order('created_at', { ascending: false });
                    return res.status(200).json({ success: true, products: data });
                }
            }

            if (action === 'get_affiliate_data') {
                const { data: affiliate } = await supabase.from('affiliate_users').select('affiliate_id, name, status, total_clicks').eq('affiliate_id', affiliateId).single();
                const { data: products } = await supabase.from('affiliate_products').select('*').eq('status', 'active');
                const { data: orders } = await supabase.from('orders').select('status').eq('affiliate_id', affiliateId);
                const stats = {
                    totalClicks: affiliate ? affiliate.total_clicks : 0,
                    totalOrders: orders ? orders.length : 0,
                    pendingOrders: orders ? orders.filter(o => ['new', 'processing'].includes(o.status)).length : 0,
                    confirmedOrders: orders ? orders.filter(o => ['delivered', 'shipped', 'completed'].includes(o.status)).length : 0,
                    cancelledOrders: orders ? orders.filter(o => o.status === 'cancelled').length : 0
                };
                return res.status(200).json({ success: true, affiliate, products, stats });
            }

            if (affiliateId) {
                const { data } = await supabase.from('orders').select('*, order_products(*)').eq('affiliate_id', affiliateId).order('created_at', { ascending: false });
                return res.status(200).json({ success: true, orders: data });
            }
            if (userId || action === 'get_user_orders') {
                const { data } = await supabase.from('orders').select('*, order_products(*)').eq('user_id', userId || req.query.userId).order('created_at', { ascending: false });
                return res.status(200).json({ success: true, orders: data });
            }
        }
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
}
