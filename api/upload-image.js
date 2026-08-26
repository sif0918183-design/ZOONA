// Vercel API endpoint for image upload
// Handles multipart form-data and uploads to ImageKit

export default async function handler(req, res) {
  // 1. التحقق من النطاق (Allowed Origins)
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoona-git-jules-imagekit-upload-integra-013f82-sifians-projects.vercel.app',
    'https://zoona-git-jules-5953511004896205445-8c60e538-sifians-projects.vercel.app',
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com',
    'https://zoona-git-secure-supabase-keys-77307646-147e2c-sifians-projects.vercel.app',
    'https://zoona-git-indicate-out-of-stock-markete-081854-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app',
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app',
    'https://zoona-git-feature-add-fitness-category-1f2a90-sifians-projects.vercel.app',
    'https://zoona-git-feature-admin-bulk-updater-14-87744e-sifians-projects.vercel.app',
    'https://zoona-git-feat-add-perfumes-category-11-43fd62-sifians-projects.vercel.app',
    'https://zoona-git-feat-turnstile-and-whatsapp-g-bd6ebc-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + "/"));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. Set CORS headers for allowed origins only
  const currentOrigin = req.headers.origin;
  if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else if (!currentOrigin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  } else {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 3. Check content-type
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
  }

  const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
  const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;

  try {
    // Check environment variables
    if (!IMAGEKIT_PRIVATE_KEY) {
      console.error('Missing environment variables: IMAGEKIT_PRIVATE_KEY');
      return res.status(500).json({ error: 'Server configuration error: Missing ImageKit credentials' });
    }

    // Get the boundary
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({ error: 'No boundary found' });
    }

    // Read the body using Node.js streams
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    // Parse multipart
    const boundaryBuf = Buffer.from('--' + boundary);
    let start = rawBody.indexOf(boundaryBuf) + boundaryBuf.length;
    
    if (start === boundaryBuf.length - 1) {
      return res.status(400).json({ error: 'Invalid multipart data format' });
    }
    
    const next = rawBody.indexOf(boundaryBuf, start);
    if (next === -1) {
      return res.status(400).json({ error: 'Could not find boundary' });
    }
    
    const part = rawBody.slice(start, next - 2);
    
    if (part.length === 0) {
      return res.status(400).json({ error: 'Empty multipart part' });
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) {
      return res.status(400).json({ error: 'Invalid multipart headers' });
    }

    const headers = part.slice(0, headerEnd).toString();
    const fileData = part.slice(headerEnd + 4);

    // Check size limit (max 5MB)
    if (fileData.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    // Extract filename and extension
    const nameMatch = headers.match(/filename="([^"]+)"/);
    const origName = nameMatch ? nameMatch[1] : 'image.jpg';
    const ext = origName.slice(origName.lastIndexOf('.')).toLowerCase() || '.jpg';

    // Validate extension
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: jpg, jpeg, png, gif, webp, svg' });
    }

    // Generate unique filename
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `product_${Date.now()}_${randomSuffix}${ext}`;

    // Upload to ImageKit API
    const formData = new FormData();
    formData.append('file', fileData.toString('base64'));
    formData.append('fileName', fileName);
    formData.append('folder', '/products');
    formData.append('useUniqueFileName', 'false');

    const authHeader = 'Basic ' + Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');

    const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      },
      body: formData
    });

    if (uploadRes.ok) {
      const ikData = await uploadRes.json();
      let publicUrl = ikData.url;
      if (!publicUrl && ikData.filePath && IMAGEKIT_URL_ENDPOINT) {
        const endpoint = IMAGEKIT_URL_ENDPOINT.replace(/\/$/, '');
        publicUrl = `${endpoint}${ikData.filePath}`;
      }
      if (!publicUrl) {
        throw new Error('ImageKit response missing URL');
      }
      return res.status(200).json({ url: publicUrl });
    } else {
      const errorText = await uploadRes.text();
      console.error('ImageKit upload failed:', uploadRes.status, errorText);
      return res.status(uploadRes.status || 500).json({ error: 'ImageKit upload failed' });
    }

  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
}
