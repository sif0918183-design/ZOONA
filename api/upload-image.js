// Vercel API endpoint for image upload
// Handles multipart form-data and uploads to Supabase Storage

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-feat-product-modal-enhancemen-94c8c9-sifians-projects.vercel.app',
    'https://zoona-git-feature-affiliate-tracking-in-16c497-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. Set CORS headers for allowed origins only
  const currentOrigin = req.headers.origin;
  
  if (currentOrigin && allowedOrigins.includes(currentOrigin)) {
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

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    // Check environment variables
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing environment variables:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY });
      return res.status(500).json({ error: 'Server configuration error: Missing Supabase credentials' });
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
    const fileName = `product_${Date.now()}${ext}`;
    const mimeType = ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1);

    // Upload to Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/products/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': `image/${mimeType}`,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'x-upsert': 'true'
        },
        body: fileData
      }
    );

    if (uploadRes.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/products/${fileName}`;
      return res.status(200).json({ url: publicUrl });
    } else {
      const errorText = await uploadRes.text();
      console.error('Supabase upload failed:', uploadRes.status, errorText);
      
      // Fallback: encode as base64 data URL for small images
      if (fileData.length < 500000) { // 500KB limit
        const base64 = fileData.toString('base64');
        const dataUrl = `data:image/${mimeType};base64,${base64}`;
        return res.status(200).json({ url: dataUrl });
      } else {
        return res.status(413).json({ error: 'Image too large. Max 500KB for base64 fallback.' });
      }
    }

  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
}