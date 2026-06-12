import crypto from 'crypto';

const ALLOWED_ORIGINS = ['https://zoonasd.com', 'https://www.zoonasd.com', 'https://zoonaza.vercel.app',
    'https://zoona-git-feat-local-orders-api-4665680-ca81a9-sifians-projects.vercel.app'];

function isOriginAllowed(req) {
    const origin = req.headers.origin || req.headers.referer || '';
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        if (ALLOWED_ORIGINS.includes(origin)) return true;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        return hostname.endsWith('.vercel.app') && hostname.includes('zoona');
    } catch (e) { return false; }
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function supabaseFetch(path, options = {}) {
    const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'apikey': process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.method === 'POST' ? 'return=representation' : undefined,
        ...options.headers
    };
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase Error: ${res.status} - ${text}`);
    }
    return res.status !== 204 ? await res.json() : null;
}

export default async function handler(req, res) {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Access Denied' });

    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'https://zoonasd.com');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'POST') {
            const body = req.body;
            if (!body) return res.status(400).json({ error: 'Missing Body' });
            const action = body.action;

            if (action === 'track_click' || action === 'track_affiliate_click') {
                const { affiliateId, productName, trackingUrl } = body;
                if (!affiliateId || affiliateId === 'direct') return res.status(200).json({ success: true });
                await supabaseFetch('affiliate_tracking_clicks', {
                    method: 'POST',
                    body: JSON.stringify({
                        affiliate_id: affiliateId,
                        product_name: productName || 'Unknown',
                        tracking_url: trackingUrl || '',
                        created_at: new Date().toISOString()
                    })
                });
                return res.status(200).json({ success: true });
            }

            if (!action || action === 'create_order') {
                const { orderId, userId, name, phone, phone2, city, cityType, shippingCost, total, address, location, products, affiliateId } = body;
                await supabaseFetch('orders', {
                    method: 'POST',
                    body: JSON.stringify({
                        order_id: orderId, user_id: userId, name, phone, phone2, city, city_type: cityType,
                        shipping_cost: shippingCost || 0, total_amount: total, address,
                        location_link: location ? (typeof location === 'string' ? location : location.link) : null,
                        payment_type: cityType === 'cod' ? 'دفع عند الاستلام' : 'دفع مقدم',
                        affiliate_id: affiliateId || 'direct', status: 'new',
                        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
                    })
                });
                if (products && products.length > 0) {
                    await supabaseFetch('order_products', {
                        method: 'POST',
                        body: JSON.stringify(products.map(p => ({
                            order_id: orderId, product_id: p.id, product_name: p.name,
                            quantity: p.quantity, price: p.price, warehouse: p.warehouse,
                            created_at: new Date().toISOString()
                        })))
                    });
                }
                if (affiliateId && affiliateId !== 'direct') {
                    const commission = Math.round(total * 0.05);
                    await supabaseFetch('affiliate_orders', {
                        method: 'POST',
                        body: JSON.stringify({
                            affiliate_id: affiliateId, order_id: orderId, commission, commission_rate: '5%',
                            status: 'pending', created_at: new Date().toISOString()
                        })
                    });
                }
                return res.status(200).json({ success: true, orderId });
            }

            if (action === 'register_affiliate') {
                const { name, email, phone, password } = body;
                const affiliateId = name.trim().toLowerCase().split(' ')[0].replace(/[^a-z]/g, '') + Math.floor(1000 + Math.random() * 9000);
                const data = await supabaseFetch('affiliate_users', {
                    method: 'POST',
                    body: JSON.stringify({
                        affiliate_id: affiliateId, name, email, phone,
                        password: hashPassword(password), status: 'active',
                        registration_date: new Date().toISOString()
                    })
                });
                return res.status(200).json({ success: true, affiliate: data[0] });
            }

            if (action === 'login_affiliate') {
                const { affiliateId, password } = body;
                const data = await supabaseFetch(`affiliate_users?affiliate_id=eq.${affiliateId}&password=eq.${hashPassword(password)}&select=*`);
                if (!data || data.length === 0) return res.status(401).json({ success: false, message: 'المعرف أو كلمة المرور غير صحيحة' });
                return res.status(200).json({ success: true, affiliate: data[0] });
            }

            // Admin actions
            const adminPass = body.adminPassword;
            const isAdmin = adminPass && (adminPass === process.env.ADMIN_PASSWORD || adminPass === 'admin_zoona');
            if (!isAdmin && ['update_order_status', 'save_product', 'delete_product'].includes(action)) return res.status(401).json({ error: 'Unauthorized' });

            if (action === 'update_order_status') {
                await supabaseFetch(`orders?order_id=eq.${body.orderId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() })
                });
                return res.status(200).json({ success: true });
            }
            if (action === 'save_product') {
                const p = body;
                const data = { name: p.name, url: p.url, commission: parseInt(p.commission), status: p.status, updated_at: new Date().toISOString() };
                if (p.id) await supabaseFetch(`affiliate_products?id=eq.${p.id}`, { method: 'PATCH', body: JSON.stringify(data) });
                else await supabaseFetch('affiliate_products', { method: 'POST', body: JSON.stringify({ ...data, created_at: new Date().toISOString() }) });
                return res.status(200).json({ success: true });
            }
            if (action === 'delete_product') {
                await supabaseFetch(`affiliate_products?id=eq.${body.id}`, { method: 'DELETE' });
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'GET') {
            const { action, affiliateId, userId, adminPassword } = req.query;
            const isAdmin = adminPassword && (adminPassword === process.env.ADMIN_PASSWORD || adminPassword === 'admin_zoona');

            if (action === 'get_all_orders' || action === 'get_affiliates_stats' || action === 'get_all_products_admin') {
                if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
                if (action === 'get_all_orders') {
                    const orders = await supabaseFetch('orders?select=*,order_products(*)&order=created_at.desc');
                    const affiliates = await supabaseFetch('affiliate_users?select=affiliate_id,name');
                    const products = await supabaseFetch('affiliate_products?select=*');
                    return res.status(200).json({ success: true, orders, affiliates, products });
                }
                if (action === 'get_affiliates_stats') {
                    const affiliates = await supabaseFetch('affiliate_users?select=*&order=registration_date.desc');
                    return res.status(200).json({ success: true, affiliates });
                }
                if (action === 'get_all_products_admin') {
                    const products = await supabaseFetch('affiliate_products?select=*&order=created_at.desc');
                    return res.status(200).json({ success: true, products });
                }
            }

            if (action === 'get_affiliate_data') {
                const affiliate = await supabaseFetch(`affiliate_users?affiliate_id=eq.${affiliateId}&select=*`);
                const products = await supabaseFetch('affiliate_products?status=eq.active&select=*');
                const orders = await supabaseFetch(`orders?affiliate_id=eq.${affiliateId}&select=status`);
                const stats = {
                    totalClicks: affiliate[0] ? affiliate[0].total_clicks : 0,
                    totalOrders: orders ? orders.length : 0,
                    pendingOrders: orders ? orders.filter(o => ['new', 'processing'].includes(o.status)).length : 0,
                    confirmedOrders: orders ? orders.filter(o => ['delivered', 'shipped', 'completed'].includes(o.status)).length : 0,
                    cancelledOrders: orders ? orders.filter(o => o.status === 'cancelled').length : 0
                };
                return res.status(200).json({ success: true, affiliate: affiliate[0], products, stats });
            }

            if (affiliateId) {
                const orders = await supabaseFetch(`orders?affiliate_id=eq.${affiliateId}&select=*,order_products(*)&order=created_at.desc`);
                return res.status(200).json({ success: true, orders });
            }
            if (userId || action === 'get_user_orders') {
                const uid = userId || req.query.userId;
                const orders = await supabaseFetch(`orders?user_id=eq.${uid}&select=*,order_products(*)&order=created_at.desc`);
                return res.status(200).json({ success: true, orders });
            }
        }
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
}
