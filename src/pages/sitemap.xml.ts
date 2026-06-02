// src/pages/sitemap.xml.ts
import type { APIRoute } from 'astro';
import servicesSlugs from './data/services_slugs.json';

export const prerender = false; // Sunucu tarafında anlık çalışması (request-time) için SSR/Hybrid zorunlu

const siteUrl = 'https://isdeyeter.com';

// Statik tanımlı kurumsal sayfalarımız
const staticPages = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/hizmet-kategorileri', priority: 0.9, changefreq: 'weekly' },
  { url: '/dijital-isler', priority: 0.9, changefreq: 'weekly' },
  { url: '/sirket-kur', priority: 0.9, changefreq: 'weekly' },
  { url: '/hakkimizda', priority: 0.8, changefreq: 'monthly' },
  { url: '/iletisim', priority: 0.8, changefreq: 'monthly' },
  { url: '/bayimiz-olun', priority: 0.7, changefreq: 'monthly' },
  { url: '/gizlilik-politikasi', priority: 0.5, changefreq: 'monthly' },
  { url: '/login', priority: 0.8, changefreq: 'monthly' }
];

export const GET: APIRoute = async (context) => {
  const lastMod = new Date().toISOString().split('T')[0];
  let dynamicUrls: string[] = [];

  // Yedeklenen tüm programmatic SEO hizmet sayfalarını dinamik site haritasına ekle
  servicesSlugs.forEach((slug: string) => {
    dynamicUrls.push(`<url>
      <loc>${siteUrl}/hizmetler/${slug}</loc>
      <lastmod>${lastMod}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.7</priority>
    </url>`);
  });

  // 1. Cloudflare D1 veritabanı bağlantısı denetimi
  const runtime = context.locals.runtime as any;
  const db = runtime?.env?.DB;

  if (db) {
    try {
      // D1 Veritabanı varsa dinamik yazıları (posts) ve ürünleri (products) sorgula
      const postsQuery = await db.prepare("SELECT slug FROM posts WHERE status = 'PUBLISHED'").all();
      if (postsQuery && postsQuery.results) {
        postsQuery.results.forEach((row: any) => {
          dynamicUrls.push(`<url>
            <loc>${siteUrl}/blog/${row.slug}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.7</priority>
          </url>`);
        });
      }

      const productsQuery = await db.prepare("SELECT id, slug FROM products WHERE status = 'ACTIVE'").all();
      if (productsQuery && productsQuery.results) {
        productsQuery.results.forEach((row: any) => {
          dynamicUrls.push(`<url>
            <loc>${siteUrl}/urun/${row.slug}</loc>
            <lastmod>${lastMod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>`);
        });
      }
    } catch (e) {
      // Veritabanı tabloları henüz oluşturulmadıysa veya boşsa hata fırlatmadan fallback yap
      console.warn("D1 Veritabanı sorgusu başarısız oldu (Tablolar henüz hazır olmayabilir). Geçici mock veri kullanılıyor.");
    }
  }

  // Eğer veritabanından dinamik veri gelmediyse sitemiz için örnek/mock veri ekleyelim
  if (dynamicUrls.length === 0) {
    const mockSlugs = ['bulut-muhasebe-nedir', 'dijital-donusum-rehberi', 'trendyolda-satis-yapmak'];
    mockSlugs.forEach(slug => {
      dynamicUrls.push(`<url>
        <loc>${siteUrl}/blog/${slug}</loc>
        <lastmod>${lastMod}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
      </url>`);
    });
  }

  // 2. Statik sayfaları XML şablonuna dönüştür
  const staticUrlsXml = staticPages.map(page => `
  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

  // 3. XML şablonunu oluştur
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0">
  ${staticUrlsXml}
  ${dynamicUrls.join('\n  ')}
</urlset>`;

  return new Response(xmlContent, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
