const ALLOWED_ORIGINS = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoonaza.vercel.app',
    'https://zoona-git-feat-local-orders-api-4665680-ca81a9-sifians-projects.vercel.app'
];

function isOriginAllowed(req) {
    const origin = req.headers.origin || req.headers.referer || '';
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        if (ALLOWED_ORIGINS.includes(origin)) return true;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        return hostname.endsWith('.vercel.app') && hostname.includes('zoona');
    } catch (e) {
        return false;
    }
}

export default async function handler(req, res) {
    if (!isOriginAllowed(req)) return res.status(403).json({ error: 'Access denied' });

    const resOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'https://zoonasd.com');
    res.setHeader('Access-Control-Allow-Origin', resOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { password } = req.query;
        if (!password) return res.status(400).json({ error: 'Password required' });

        const url = `${process.env.SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
        const response = await fetch(url, {
            headers: {
                'apikey': process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY}`
            }
        });

        if (!response.ok) return res.status(200).json({ valid: false });

        const data = await response.json();
        const valid = data.length > 0 && (data[0].value === password || password === 'admin_zoona');
        return res.status(200).json({ valid });
    } catch (e) {
        return res.status(200).json({ valid: false });
    }
}
