// src/pages/rss.xml.ts
import type { APIRoute } from 'astro';

export const prerender = false; // Sunucu tarafında anlık çalışması (request-time) için SSR/Hybrid zorunlu

const siteUrl = 'https://isdeyeter.com';

// Özel XML karakter kaçış fonksiyonu
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// RFC 822 formatında tarih üretici (Örn: Tue, 02 Jun 2026 10:00:00 +0000)
function toRfc822Date(date: Date): string {
  return date.toUTCString();
}

interface BlogPost {
  title: string;
  description: string;
  slug: string;
  published_at: Date;
  author?: string;
}

export const GET: APIRoute = async (context) => {
  let posts: BlogPost[] = [];

  // 1. Cloudflare D1 veritabanından son 20 blog yazısını anlık sorgula
  const runtime = context.locals.runtime as any;
  const db = runtime?.env?.DB;

  if (db) {
    try {
      const postsQuery = await db.prepare(
        "SELECT title, description, slug, created_at FROM posts WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 20"
      ).all();

      if (postsQuery && postsQuery.results) {
        posts = postsQuery.results.map((row: any) => ({
          title: row.title,
          description: row.description || '',
          slug: row.slug,
          published_at: new Date(row.created_at || Date.now())
        }));
      }
    } catch (e) {
      console.warn("D1 Veritabanı RSS blog sorgusu başarısız oldu. Geçici mock veriler kullanılıyor.");
    }
  }

  // Veritabanı tabloları henüz yoksa veya boşsa fallback olarak mock blog yazıları sunalım
  if (posts.length === 0) {
    posts = [
      {
        title: "Bulut Muhasebe Yazılımlarının İşletmelere Sağladığı 5 Önemli Fayda",
        description: "Modern işletmeler için bulut tabanlı ön muhasebe ve cari takip çözümlerinin maliyet, hız ve erişilebilirlik avantajlarını inceledik.",
        slug: "bulut-muhasebe-nedir",
        published_at: new Date("2026-06-01T10:00:00Z")
      },
      {
        title: "KOBİ'ler İçin Dijital Dönüşüm Rehberi 2026",
        description: "Geleneksel esnaflıktan dijital platformlara geçişte dikkat edilmesi gereken adımlar, web sitesi kurma ve online ödeme altyapıları.",
        slug: "dijital-donusum-rehberi",
        published_at: new Date("2026-05-28T09:00:00Z")
      },
      {
        title: "Trendyol'da Satış Yaparken Dikkat Edilmesi Gereken Entegrasyon Kuralları",
        description: "Trendyol mağazanızı ERP ve CRM sistemleriyle tam otomatik bağlayarak stok hatalarından nasıl kaçınacağınızı öğrenin.",
        slug: "trendyolda-satis-yapmak",
        published_at: new Date("2026-05-25T14:30:00Z")
      }
    ];
  }

  // 2. RSS XML içeriğini üret
  const itemsXml = posts.map(post => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${siteUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${post.slug}</guid>
      <pubDate>${toRfc822Date(post.published_at)}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`).join('');

  const rssContent = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>İş De Yeter - Profesyonel Hizmet Platformu Blogu</title>
    <link>${siteUrl}</link>
    <description>Modern, hızlı ve SEO uyumlu hizmet pazaryeri, kurumsal e-ticaret ve blog akışı</description>
    <language>tr-tr</language>
    <lastBuildDate>${toRfc822Date(new Date())}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new Response(rssContent, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
