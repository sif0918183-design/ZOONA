const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const categorySlugs = {
  'الكل': 'all',
  'موبايلات': 'mobiles',
  'أجهزة إلكترونية': 'electronics',
  'أجهزة كهربائية': 'electrical-appliances',
  'ألعاب أطفال': 'toys',
  'إكسسوارات موبايلات': 'accessories',
  'تجميل': 'cosmetics',
  'مستحضرات تجميل': 'cosmetics',
  'أزياء نسائية': 'women-fashion',
  'المنزل والمطبخ': 'home-kitchen',
  'اللياقة والرياضة': 'sports-fitness',
  'الرياضة واللياقة': 'sports-fitness'
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

  // 1. Static Routes (including blog-page_99.html as in original sitemap)
  // Use '/' instead of '' to produce trailing slash (https://zoonasd.com/)
  const staticRoutes = [
    '/',
    '/p/afraa-market.html',
    '/p/blog-page_57.html',
    '/p/blog-page_24.html',
    '/p/blog-page_38.html',
    '/p/blog-page_99.html'
  ];

  let dynamicCategoryRoutes = [];
  let dynamicProductRoutes = [];

  try {
    // Fetch products to dynamically construct product links and extract categories
    const fetchUrl = `${SUPABASE_URL}/rest/v1/products?select=name,category&order=id.desc`;
    const response = await fetch(fetchUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (response.ok) {
      const products = await response.json();

      // Build dynamic product routes
      dynamicProductRoutes = products
        .map(p => p.name ? `/${slugify(p.name)}` : '')
        .filter(route => route !== '');

      // Build dynamic category routes
      const uniqueCategories = new Set();

      // Seed with standard categories from categorySlugs mapping (excluding 'الكل')
      Object.keys(categorySlugs).forEach(cat => {
        if (cat !== 'الكل') {
          uniqueCategories.add(cat);
        }
      });

      // Extract and split categories from fetched products
      products.forEach(p => {
        if (p.category) {
          const parts = p.category.split('/').map(s => s.trim());
          parts.forEach(part => {
            if (part && part !== 'الكل') {
              // Normalize category name
              const normalized = part === 'مستحضرات تجميل' ? 'تجميل' : part;
              uniqueCategories.add(normalized);
            }
          });
        }
      });

      // Convert unique category names into slugs
      const uniqueSlugs = new Set();
      uniqueCategories.forEach(catName => {
        const slug = slugify(catName);
        if (slug && slug !== 'all') {
          uniqueSlugs.add(slug);
        }
      });

      dynamicCategoryRoutes = Array.from(uniqueSlugs).map(slug => `/c/${slug}`);
    } else {
      console.error(`Supabase returned status ${response.status} when fetching products for sitemap`);
    }
  } catch (e) {
    console.error('Error fetching products/categories for sitemap:', e);
  }

  // Fallback category routes if fetch fails or is empty
  if (dynamicCategoryRoutes.length === 0) {
    const defaultSlugs = Object.values(categorySlugs).filter(s => s !== 'all');
    dynamicCategoryRoutes = Array.from(new Set(defaultSlugs)).map(slug => `/c/${slug}`);
  }

  // Combine and deduplicate all routes
  const allUniqueRoutes = Array.from(new Set([...staticRoutes, ...dynamicCategoryRoutes, ...dynamicProductRoutes]));
  const lastMod = new Date().toISOString().split('T')[0];

  // Generate Google-friendly XML Sitemap
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUniqueRoutes.map(route => {
  let priority = '0.6';
  let changefreq = 'weekly';

  if (route === '/') {
    priority = '1.0';
    changefreq = 'daily';
  } else if (route.startsWith('/c/')) {
    priority = '0.8';
    changefreq = 'daily';
  } else if (route.startsWith('/p/')) {
    priority = '0.7';
    changefreq = 'weekly';
  }

  // To prevent double slashes (e.g., https://zoonasd.com//p/...) if baseUrl ends in / or route starts with /
  // Since baseUrl is 'https://zoonasd.com' and route starts with '/', we can safely join them as baseUrl + route.
  // But if route is '/', baseUrl + route is 'https://zoonasd.com/' which is perfect!
  const fullUrl = `${baseUrl}${route}`;

  return `  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'text/xml');
  // Use a sensible cache duration: CDN cache 1 hour, stale-while-revalidate 1 day
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(sitemapXml);
}
