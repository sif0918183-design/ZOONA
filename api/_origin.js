const ALLOWED_ORIGINS = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoonaza.vercel.app'
];

export function isOriginAllowed(req) {
    const origin = req.headers.origin || req.headers.referer || '';
    if (!origin) return false;
    try {
        const url = new URL(origin);
        const hostname = url.hostname;
        if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) return true;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
        return hostname.endsWith('.vercel.app') && hostname.includes('zoona');
    } catch (e) {
        return false;
    }
}
