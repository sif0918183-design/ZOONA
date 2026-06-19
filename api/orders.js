/**
 * Vercel API: /api/orders
 * Centralized handler for affiliate management, tracking, and orders.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// SHA-256 helper for password hashing
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req, res) {
    // 1. CORS Headers
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://zoonasd.com',
        'https://www.zoonasd.com',
    ];

    // Allow .vercel.app origins for preview
    if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // 2. Parse request
    let body = {};
    if (req.method === 'POST') {
        if (typeof req.body === 'string') {
            try { body = JSON.parse(req.body); } catch (e) { body = {}; }
        } else {
            body = req.body || {};
        }
    }

    const action = req.query.action || body.action;

    try {
        // --- Authentication Actions ---

        if (action === 'register_affiliate') {
            const { name, email, phone, password } = body;

            if (!name || !phone || !password) {
                return res.status(400).json({ success: false, error: 'Missing required fields' });
            }

            // Generate a unique affiliate ID
            const namePart = name.trim().toLowerCase().replace(/\s+/g, '').substring(0, 10);
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const affiliateId = `${namePart}${randomNum}`;
            const hashedPassword = await sha256(password);

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
                    password_hash: hashedPassword,
                    status: 'active',
                    created_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            const data = await response.json();
            return res.status(201).json({ success: true, affiliate: data[0] });
        }

        if (action === 'login_affiliate') {
            const { affiliateId, password } = body;

            if (!affiliateId || !password) {
                return res.status(400).json({ success: false, error: 'Missing credentials' });
            }

            const hashedPassword = await sha256(password);

            // Query by case-insensitive ID
            const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=ilike.${affiliateId}&select=*`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            const data = await response.json();

            if (!response.ok || data.length === 0) {
                return res.status(401).json({ success: false, error: 'Invalid affiliate ID or password' });
            }

            const affiliate = data[0];
            if (affiliate.password_hash !== hashedPassword) {
                return res.status(401).json({ success: false, error: 'Invalid affiliate ID or password' });
            }

            if (affiliate.status !== 'active') {
                return res.status(403).json({ success: false, error: 'Account is inactive' });
            }

            return res.status(200).json({ success: true, affiliate });
        }

        // --- Tracking and Order Actions ---

        if (action === 'track_click') {
            const { affiliateId, productName, trackingUrl } = body;

            if (!affiliateId) {
                return res.status(400).json({ success: false, error: 'Affiliate ID is required' });
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_clicks`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    affiliate_id: affiliateId,
                    product_name: productName || 'Generic Click',
                    tracking_url: trackingUrl || '',
                    created_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true, message: 'Click tracked' });
        }

        if (action === 'create_order') {
            const {
                orderId, userId, name, phone, phone2, products,
                city, cityType, shippingCost, total, address,
                location, affiliateId
            } = body;

            if (!orderId || !name || !phone || !products || products.length === 0) {
                return res.status(400).json({ success: false, error: 'Missing required order details' });
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
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
                    location_data: location,
                    affiliate_id: affiliateId && affiliateId !== 'direct' ? affiliateId : null,
                    status: 'new',
                    created_at: new Date().toISOString()
                })
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            const order = await response.json();

            // Insert order products
            const orderProducts = products.map(p => ({
                order_id: orderId,
                product_id: p.id,
                product_name: p.name,
                quantity: p.quantity,
                price: p.price,
                warehouse: p.warehouse
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

            return res.status(201).json({ success: true, message: 'Order created', order: order[0] });
        }

        if (action === 'get_user_orders') {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({ success: false, error: 'User ID is required' });
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?user_id=eq.${userId}&select=*,order_products(*)&order=created_at.desc`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            const orders = await response.json();
            return res.status(200).json({ success: true, orders });
        }

        if (action === 'get_affiliate_orders') {
            const { affiliateId } = req.query;

            if (!affiliateId) {
                return res.status(400).json({ success: false, error: 'Affiliate ID is required' });
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affiliateId}&select=*,order_products(*)&order=created_at.desc`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            const orders = await response.json();
            return res.status(200).json({ success: true, orders });
        }

        if (action === 'get_affiliate_data') {
            const { affiliateId } = req.query;
            if (!affiliateId) return res.status(400).json({ success: false, error: 'Affiliate ID is required' });

            // 1. Get Affiliate Basic Info
            const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=ilike.${affiliateId}&select=*`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const affData = await affRes.json();
            if (!affRes.ok || affData.length === 0) return res.status(404).json({ success: false, error: 'Affiliate not found' });
            const affiliate = affData[0];

            // 2. Get Statistics
            const clicksRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_clicks?affiliate_id=eq.${affiliate.affiliate_id}&select=count`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
            });
            const totalClicks = parseInt(clicksRes.headers.get('content-range')?.split('/')[1] || 0);

            const ordersRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?affiliate_id=eq.${affiliate.affiliate_id}&select=status`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const orders = await ordersRes.json();

            const stats = {
                totalClicks,
                totalOrders: orders.length,
                pendingOrders: orders.filter(o => ['new', 'processing', 'shipped', 'pending'].includes(o.status)).length,
                confirmedOrders: orders.filter(o => ['confirmed', 'delivered', 'completed'].includes(o.status)).length,
                cancelledOrders: orders.filter(o => o.status === 'cancelled').length
            };

            // 3. Get Commissions Summary
            const commsRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?affiliate_id=eq.${affiliate.affiliate_id}&select=*`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const commissions = await commsRes.json();

            const commissionSummary = {
                confirmed: commissions.filter(c => c.status === 'unpaid').reduce((sum, c) => sum + (c.amount || 0), 0),
                paid: commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0)
            };

            // 4. Get Products for dashboard dropdown
            const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,commission,id&order=id.desc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const products = await prodRes.json();

            return res.status(200).json({
                success: true,
                affiliate,
                stats,
                commissionSummary,
                products
            });
        }

        if (action === 'update_order_status') {
            const { orderId, status } = body;
            if (!orderId || !status) return res.status(400).json({ success: false, error: 'Order ID and status are required' });

            // 1. Update order status
            const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?order_id=eq.${orderId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ status, updated_at: new Date().toISOString() })
            });

            if (!updateRes.ok) {
                const error = await updateRes.json();
                return res.status(updateRes.status).json({ success: false, error: error.message });
            }

            const updatedOrders = await updateRes.json();
            const order = updatedOrders[0];

            // 2. If status is completed/delivered/confirmed, and there's an affiliate, record commission
            const completedStatuses = ['completed', 'delivered', 'confirmed', 'تم التوصيل', 'مكتمل'];
            if (completedStatuses.includes(status) && order.affiliate_id) {
                // Check if commission already recorded for this order
                const checkCommRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?order_id=eq.${orderId}&select=id`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const existingComm = await checkCommRes.json();

                if (existingComm.length === 0) {
                    // Fetch order products to calculate commission
                    const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/order_products?order_id=eq.${orderId}&select=*`, {
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                    });
                    const orderProds = await prodRes.json();

                    // Fetch products to get commission amounts
                    const allProdsRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,commission`, {
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                    });
                    const allProds = await allProdsRes.json();

                    let totalComm = 0;
                    orderProds.forEach(op => {
                        const product = allProds.find(p => p.name === op.product_name);
                        if (product && product.commission) {
                            totalComm += product.commission * (op.quantity || 1);
                        } else {
                            // Default 5% if product commission not set
                            totalComm += Math.round((op.price * op.quantity) * 0.05);
                        }
                    });

                    if (totalComm > 0) {
                        await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions`, {
                            method: 'POST',
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                affiliate_id: order.affiliate_id,
                                order_id: orderId,
                                amount: totalComm,
                                status: 'unpaid',
                                created_at: new Date().toISOString()
                            })
                        });
                    }
                }
            }

            return res.status(200).json({ success: true, message: 'Status updated' });
        }

        if (action === 'get_all_orders') {
            // Join with affiliate_commissions to get payout status
            const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*,order_products(*),affiliate_commissions(status)&order=created_at.desc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            let orders = await response.json();

            // Map affiliate_commissions status to a top-level affiliate_status property
            orders = orders.map(order => {
                const commission = order.affiliate_commissions && order.affiliate_commissions[0];
                return {
                    ...order,
                    affiliate_status: commission ? commission.status : 'unpaid'
                };
            });

            const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=affiliate_id,name`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const affiliates = await affRes.json();

            const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=name,commission`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const products = await prodRes.json();

            return res.status(200).json({ success: true, orders, affiliates, products });
        }

        if (action === 'get_affiliates_stats') {
            const affRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?select=*&order=created_at.desc`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const affiliates = await affRes.json();

            // Fetch clicks count for each
            for (let aff of affiliates) {
                const clicksRes = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_clicks?affiliate_id=eq.${aff.affiliate_id}&select=count`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'count=exact' }
                });
                aff.total_clicks = parseInt(clicksRes.headers.get('content-range')?.split('/')[1] || 0);
            }

            return res.status(200).json({ success: true, affiliates });
        }

        if (action === 'update_payout_status') {
            const { orderId, status } = body; // status: 'paid' or 'unpaid'
            if (!orderId || !status) return res.status(400).json({ success: false, error: 'Order ID and status are required' });

            const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliate_commissions?order_id=eq.${orderId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, updated_at: new Date().toISOString() })
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true, message: `Commission marked as ${status}` });
        }

        if (action === 'update_affiliate_status') {
            const { affiliateId, status } = body;
            if (!affiliateId || !status) return res.status(400).json({ success: false, error: 'Affiliate ID and status are required' });

            const response = await fetch(`${SUPABASE_URL}/rest/v1/affiliates?affiliate_id=eq.${affiliateId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                const error = await response.json();
                return res.status(response.status).json({ success: false, error: error.message });
            }

            return res.status(200).json({ success: true, message: 'Affiliate status updated' });
        }

        return res.status(400).json({ error: 'Unknown action' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
