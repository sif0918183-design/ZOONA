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
    if (req.method !== 'GET') return res.status(405).end();

    const resOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : 'https://zoonasd.com');
    res.setHeader('Access-Control-Allow-Origin', resOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { id } = req.query;
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

        const fetchUrl = id ? `${supabaseUrl}/rest/v1/products?id=eq.${id}&select=*` : `${supabaseUrl}/rest/v1/products?select=*&order=id.desc`;

        const response = await fetch(fetchUrl, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        const data = await response.json();
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).json(id ? (data[0] || null) : data);
    } catch (error) {
        return res.status(500).json({ error: 'Database error' });
    }
}
