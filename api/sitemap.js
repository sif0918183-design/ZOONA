const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const categorySlugs = {
  'الكل': 'all',
  'موبايلات': 'mobiles',
  'أجهزة إلكترونية': 'electronics',
  'أجهزة كهربائية': 'electrical-appliances',
  'ألعاب أطفال': 'toys',
  'إكسسوارات موبايلات': 'accessories',
  'مستحضرات تجميل': 'cosmetics',
  'أزياء نسائية': 'women-fashion',
  'المنزل والمطبخ': 'home-kitchen'
};

function transliterateArabic(text) {
  const mapping = {
    'أ': 'a', 'إ': 'i', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
    'ي': 'y', 'ى': 'a', 'ة': 't', 'ؤ': 'u', 'ئ': 'i', 'ء': 'a'
  };
  return text.split('').map(char => mapping[char] || char).join('');
}

function slugify(text) {
  if (!text) return "";
  const trimmed = text.toString().trim();
  if (categorySlugs[trimmed]) return categorySlugs[trimmed];

  const words = trimmed.split(/\s+/).slice(0, 3).join(' ');
  return transliterateArabic(words.toLowerCase())
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export default async function handler(req, res) {
  const baseUrl = 'https://zoonasd.com';

  // 1. Static Routes
  const staticRoutes = [
    '',
    '/p/afraa-market.html',
    '/p/blog-page_57.html',
    '/p/blog-page_24.html',
    '/p/blog-page_38.html'
  ];

  // 2. Dynamic Categories
  const categories = Object.values(categorySlugs).filter(s => s !== 'all');
  const categoryRoutes = categories.map(slug => `/c/${slug}`);

  // 3. Dynamic Products from Supabase
  let productRoutes = [];
  try {
    const fetchUrl = `${SUPABASE_URL}/rest/v1/products?select=name&order=id.desc`;
    const response = await fetch(fetchUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (response.ok) {
      const products = await response.json();
      productRoutes = products.map(p => `/${slugify(p.name)}`);
    }
  } catch (e) {
    console.error('Error fetching products for sitemap:', e);
  }

  const allRoutes = [...staticRoutes, ...categoryRoutes, ...productRoutes];
  const lastMod = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes.map(route => `  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${route === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${route === '' ? '1.0' : route.startsWith('/c/') ? '0.8' : '0.6'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'text/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  res.status(200).send(sitemap);
}
