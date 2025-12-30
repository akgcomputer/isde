// src/pages/sitemap.xml.js (veya .ts)
export async function get() {
  const pages = [
    { url: '/', lastmod: new Date().toISOString(), priority: 1.0 },
    { url: '/bayimiz-olun', lastmod: new Date().toISOString(), priority: 0.8 },
    { url: '/gizlilik-politikasi', lastmod: new Date().toISOString(), priority: 0.3 },
    // Diğer sayfalar...
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages.map(page => `
  <url>
    <loc>https://isdeyeter.com${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <priority>${page.priority}</priority>
  </url>
  `).join('')}
</urlset>`;

  return {
    body: sitemap,
    headers: {
      'Content-Type': 'application/xml'
    }
  };
}