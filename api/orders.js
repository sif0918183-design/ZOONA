/**
 * Vercel API: /api/orders
 * Acts as a secure proxy for Supabase to hide keys and restrict access.
 */

export default async function handler(req, res) {
  // 1. Origin Restriction
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoona-git-jules-imagekit-upload-integra-013f82-sifians-projects.vercel.app',
    'https://zoona-git-jules-5953511004896205445-8c60e538-sifians-projects.vercel.app',
    'https://zoona-git-feature-admin-bulk-updater-14-87744e-sifians-projects.vercel.app',
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com',
    'https://zoona-git-secure-supabase-keys-77307646-147e2c-sifians-projects.vercel.app',
    'https://zoona-git-indicate-out-of-stock-markete-081854-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app',
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app',
    'https://zoona-git-login-synchronization-and-secu-5e5d31-sifians-projects.vercel.app',
    'https://zoona-git-secure-tiered-commission-v2-d1be82-sifians-projects.vercel.app',
    'https://zoona-git-fix-admin-login-and-rls-v3-203597-sifians-projects.vercel.app',
    'https://zoona-git-add-marketer-guide-modal-3611-3e20ab-sifians-projects.vercel.app',
    'https://zoona-git-feature-add-fitness-category-1f2a90-sifians-projects.vercel.app',
    'https://zoona-git-feat-add-perfumes-category-11-43fd62-sifians-projects.vercel.app',
    'https://zoona-git-feat-turnstile-and-whatsapp-g-bd6ebc-sifians-projects.vercel.app'
  ];

  // Check if origin starts with any allowed origin
  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + "/"));

  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. CORS Headers
  const currentOrigin = req.headers.origin;
  if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer, apikey');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 4. Extract target endpoint and auth info
  const fullUrl = new URL(req.url, `http://${req.headers.host}`);
  const endpoint = fullUrl.searchParams.get('endpoint');
  const action = fullUrl.searchParams.get('action');
  const adminPassword = fullUrl.searchParams.get('adminPassword');

  // 3. Supabase Credentials from Environment Variables
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Specialized Action: Affiliate Login (uses SERVICE_KEY for privacy)
  if (action === 'login_affiliate') {
    const { affiliateId, password } = req.body;
    if (!affiliateId || !password) return res.status(400).json({ error: 'Missing credentials' });

    const key = SERVICE_KEY || SUPABASE_KEY;
    const fetchUrl = `${SUPABASE_URL}/rest/v1/affiliate_users?affiliate_id=eq.${encodeURIComponent(affiliateId)}&select=*`;
    const response = await fetch(fetchUrl, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (!response.ok) return res.status(response.status).json({ error: 'Auth fetch failed' });

    const data = await response.json();

    if (!data || data.length === 0 || data[0].password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = data[0];
    delete user.password; // Privacy: Remove password before returning
    return res.status(200).json({ success: true, affiliate: user });
  }

  // Specialized Action: Get Cloudflare Turnstile Site Key Config
  if (action === 'get_turnstile_config') {
    const siteKey = process.env.TURNSTILE_SITE_KEY ||
                    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
                    process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ||
                    '';
    return res.status(200).json({ siteKey });
  }

  // Specialized Action: Register Affiliate with Turnstile Human Verification
  if (action === 'register_affiliate') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, phone, password, turnstileToken } = req.body || {};

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    // 1. Cloudflare Turnstile Verification
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY ||
                            process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ||
                            '';
    if (turnstileSecret) {
      if (!turnstileToken) {
        return res.status(400).json({ error: 'يرجى إكمال التحقق البشري' });
      }

      try {
        const formData = new URLSearchParams();
        formData.append('secret', turnstileSecret);
        formData.append('response', turnstileToken);
        const remoteIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
        if (remoteIp) {
          formData.append('remoteip', remoteIp.split(',')[0].trim());
        }

        const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          body: formData
        });

        const turnstileData = await turnstileRes.json();
        if (!turnstileData.success) {
          console.error('[Orders-Proxy] Turnstile verification failed:', turnstileData['error-codes']);
          return res.status(400).json({ error: 'فشل التحقق البشري، يرجى إعادة المحاولة' });
        }
      } catch (err) {
        console.error('[Orders-Proxy] Turnstile fetch error:', err);
        return res.status(500).json({ error: 'خطأ في التحقق من التحدي البشري' });
      }
    } else {
      console.warn('[Orders-Proxy] TURNSTILE_SECRET_KEY is not set in environment.');
    }

    const key = SERVICE_KEY || SUPABASE_KEY;
    if (!SUPABASE_URL || !key) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 2. Check duplicate email or phone
    const checkUrl = `${SUPABASE_URL}/rest/v1/affiliate_users?select=email,phone&or=(email.eq.${encodeURIComponent(email)},phone.eq.${encodeURIComponent(phone)})`;
    const checkRes = await fetch(checkUrl, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });

    if (!checkRes.ok) {
      const errText = await checkRes.text();
      console.error('[Orders-Proxy] Register check failed:', checkRes.status, errText);
      return res.status(500).json({ error: 'خطأ في فحص بيانات المسوق' });
    }

    const existingUsers = await checkRes.json();
    if (existingUsers && existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.email === email) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
      }
      if (existing.phone === phone) {
        return res.status(400).json({ error: 'رقم الهاتف مسجل بالفعل' });
      }
    }

    // 3. Generate unique affiliate_id (sanitized first name + random 4-digit number)
    const firstName = name.trim().split(' ')[0];
    const sanitizedName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');

    let affiliateId = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      affiliateId = sanitizedName + randomNum;

      const idCheckUrl = `${SUPABASE_URL}/rest/v1/affiliate_users?select=affiliate_id&affiliate_id=eq.${encodeURIComponent(affiliateId)}`;
      const idCheckRes = await fetch(idCheckUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      if (idCheckRes.ok) {
        const idData = await idCheckRes.json();
        if (!idData || idData.length === 0) {
          isUnique = true;
        }
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(400).json({ error: 'فشل في إنشاء معرف فريد، يرجى المحاولة مرة أخرى' });
    }

    // 4. Insert new marketer record
    const newAffiliate = {
      affiliate_id: affiliateId,
      name: name,
      email: email,
      phone: phone,
      password: password,
      created_at: new Date().toISOString(),
      total_clicks: 0,
      total_orders: 0
    };

    const insertUrl = `${SUPABASE_URL}/rest/v1/affiliate_users`;
    const insertRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newAffiliate)
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      console.error('[Orders-Proxy] Register insert failed:', insertRes.status, errText);
      return res.status(500).json({ error: 'فشل إكمال عملية التسجيل' });
    }

    return res.status(200).json({
      success: true,
      message: 'تم التسجيل بنجاح',
      affiliate: newAffiliate
    });
  }

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint query parameter is required' });
  }

  // 5. Server-side Authorization for Admin Actions
  const isWriteOp = ['POST', 'PATCH', 'DELETE'].includes(req.method);

  // Extract base table name for matching (removes query params)
  const baseTable = endpoint.split('?')[0].split('/')[0];

  const isAdminTable = baseTable === 'admin_settings';
  const isSensitiveAffiliateOp = baseTable === 'affiliate_users' && req.method === 'PATCH';

  // Define public tables that allow POST/PATCH for customer/marketer actions
  const publicPostTables = ['orders', 'order_products', 'affiliate_orders', 'affiliate_users', 'affiliate_clicks', 'clicks'];
  const publicPatchTables = ['affiliate_users', 'affiliate_clicks'];

  if (isWriteOp || isAdminTable || isSensitiveAffiliateOp) {
    // 1. Allow public GET for settings (Threshold, Rates) but NOT password
    const isPublicSelect = req.method === 'GET' &&
                          isAdminTable &&
                          !endpoint.includes('admin_password');

    // 2. Allow public POST for order/marketer tables
    const isPublicPost = req.method === 'POST' && publicPostTables.includes(baseTable);

    // 3. Allow public PATCH for marketer stats
    const isPublicPatch = req.method === 'PATCH' && publicPatchTables.includes(baseTable);

    if (!isPublicSelect && !isPublicPost && !isPublicPatch) {
      if (!adminPassword) {
        return res.status(401).json({
          error: 'Admin password required for this operation',
          details: { method: req.method, table: baseTable, endpoint: endpoint }
        });
      }

      if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Supabase credentials missing for admin action');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // Hash provided password to compare with DB
      const crypto = await import('crypto');
      const hashedProvided = crypto.createHash('sha256').update(adminPassword).digest('hex');

      // Verify hashed password against DB using SERVICE_KEY to bypass RLS
      const key = SERVICE_KEY || SUPABASE_KEY;
      const authUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
      const authResponse = await fetch(authUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });

      if (!authResponse.ok) {
          console.error('[Orders-Proxy] Auth Fetch Failed:', authResponse.status);
          return res.status(500).json({ error: 'Internal Auth Error' });
      }

      const authData = await authResponse.json();

      if (!authData || authData.length === 0 || authData[0].value !== hashedProvided) {
        console.error('[Orders-Proxy] Unauthorized access attempt or row missing.');
        return res.status(403).json({ error: 'Unauthorized: Invalid admin password' });
      }
    }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Proceed with the actual request
  const fetchUrl = `${SUPABASE_URL}/rest/v1/${endpoint}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': req.headers['prefer'] || (req.method === 'POST' ? 'return=representation' : 'return=minimal')
      }
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.clone().text().catch(() => 'No text');
      console.error(`[Orders-Proxy] Supabase returned error status ${response.status} for ${req.method} to ${endpoint}: ${errorText}`);
    }

    if (response.status === 204) {
      return res.status(204).end();
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
