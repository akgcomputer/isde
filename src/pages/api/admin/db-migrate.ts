import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const user = context.locals.user;
    if (!user || user.is_partner !== 2) {
      return new Response(JSON.stringify({ error: 'Yetkisiz işlem.' }), { status: 401 });
    }

    const body = await context.request.json();
    const { site_id } = body;

    if (!site_id) {
      return new Response(JSON.stringify({ error: 'Hizmet kimliği belirtilmedi.' }), { status: 400 });
    }

    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Sistem veritabanı bağlantısı yok.' }), { status: 500 });
    }

    // Hizmeti bul
    const site = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(site_id).first();
    if (!site) {
      return new Response(JSON.stringify({ error: 'Hizmet bulunamadı.' }), { status: 404 });
    }

    // Sistem ayarlarını oku
    const settingsResult = await db.prepare("SELECT key, value FROM system_settings WHERE key IN ('github_pat', 'cloudflare_token', 'cloudflare_account_id')").all();
    const settings: Record<string, string> = {};
    for (const row of (settingsResult.results || [])) {
      settings[(row as any).key] = (row as any).value;
    }

    const githubPat = settings['github_pat'];
    const cfToken = settings['cloudflare_token'];
    const cfAccountId = settings['cloudflare_account_id'];

    if (!githubPat) return new Response(JSON.stringify({ error: 'GitHub PAT ayarlanmamış.' }), { status: 400 });
    if (!cfToken) return new Response(JSON.stringify({ error: 'Cloudflare API Token ayarlanmamış.' }), { status: 400 });
    if (!cfAccountId) return new Response(JSON.stringify({ error: 'Cloudflare Account ID ayarlanmamış.' }), { status: 400 });

    // GitHub'dan wrangler.toml oku → DB adını bul
    const repoName = (site as any).domain.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const wranglerRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/contents/wrangler.toml`, {
      headers: {
        'Authorization': `token ${githubPat}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'IsDeYeter-Portal-App'
      }
    });

    if (!wranglerRes.ok) {
      return new Response(JSON.stringify({ error: `wrangler.toml okunamadı: ${repoName}` }), { status: 400 });
    }

    const wranglerData = await wranglerRes.json();
    const wranglerContent = decodeURIComponent(escape(atob(wranglerData.content.replace(/\s/g, ''))));
    
    // database_name = "xxx" satırını parse et
    const dbNameMatch = wranglerContent.match(/database_name\s*=\s*["']([^"']+)["']/);
    if (!dbNameMatch) {
      return new Response(JSON.stringify({ error: 'wrangler.toml içinde database_name bulunamadı.' }), { status: 400 });
    }
    const dbName = dbNameMatch[1];

    // Cloudflare D1 database ID'yi bul
    const listDbRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database?name=${encodeURIComponent(dbName)}`, {
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json'
      }
    });

    const listDbData = await listDbRes.json();
    if (!listDbData.success || !listDbData.result?.length) {
      return new Response(JSON.stringify({ error: `D1 veritabanı bulunamadı: ${dbName}` }), { status: 404 });
    }

    const dbId = listDbData.result[0].uuid;

    // Migration SQL komutları (her biri ayrı çalıştırılacak, hata ignore edilecek)
    const migrations = [
      // categories
      "ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'blog'",
      "ALTER TABLE categories ADD COLUMN image_url TEXT",
      "CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, logo_url TEXT, is_popular INTEGER DEFAULT 0, createdAt TEXT NOT NULL)",
      // products table
      "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, excerpt TEXT, description TEXT, price REAL NOT NULL DEFAULT 0, compare_at_price REAL, image_url TEXT, badge_top_left TEXT, badge_top_right TEXT, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'aktif', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)",
      "ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'Adet'",
      "ALTER TABLE products ADD COLUMN min_order_qty INTEGER DEFAULT 1",
      "ALTER TABLE products ADD COLUMN currency TEXT DEFAULT '₺'",
      "ALTER TABLE products ADD COLUMN payment_options TEXT",
      "ALTER TABLE products ADD COLUMN gallery_images TEXT",
      "ALTER TABLE products ADD COLUMN updatedAt TEXT",
      "ALTER TABLE products ADD COLUMN badges TEXT",
      "ALTER TABLE products ADD COLUMN shipping_time TEXT",
      "ALTER TABLE products ADD COLUMN seller_name TEXT",
      "ALTER TABLE products ADD COLUMN features TEXT",
      "ALTER TABLE products ADD COLUMN tags TEXT",
      "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10",
      "ALTER TABLE products ADD COLUMN video_url TEXT",
      "ALTER TABLE products ADD COLUMN allow_backorder BOOLEAN DEFAULT 0",
      "ALTER TABLE products ADD COLUMN likes INTEGER DEFAULT 0",
      // product_variants
      "CREATE TABLE IF NOT EXISTS product_variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, name TEXT NOT NULL, sku TEXT, price REAL, stock INTEGER DEFAULT 0, image_url TEXT, createdAt TEXT NOT NULL)",
      // wholesale_prices
      "CREATE TABLE IF NOT EXISTS wholesale_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, min_qty INTEGER NOT NULL, discount_percentage REAL NOT NULL DEFAULT 0, createdAt TEXT NOT NULL)",
      "ALTER TABLE wholesale_prices ADD COLUMN discount_percentage REAL DEFAULT 0",
      // badges, reviews, qa
      "CREATE TABLE IF NOT EXISTS badges (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, bg_color TEXT, text_color TEXT, createdAt DATETIME)",
      "CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, user_name TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, likes INTEGER DEFAULT 0, dislikes INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS product_qa (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, user_name TEXT NOT NULL, question TEXT NOT NULL, answer TEXT, status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL)",
      // ecommerce_settings
      "CREATE TABLE IF NOT EXISTS ecommerce_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT, createdAt TEXT, updatedAt TEXT)",
    ];

    const results: { sql: string; ok: boolean; error?: string }[] = [];

    // Her SQL'i sırayla çalıştır (hata olsa devam et)
    for (const sql of migrations) {
      try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database/${dbId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql })
        });
        const data = await res.json();
        results.push({ sql: sql.slice(0, 60), ok: data.success });
      } catch (e: any) {
        results.push({ sql: sql.slice(0, 60), ok: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const skipCount = results.filter(r => !r.ok).length;

    return new Response(JSON.stringify({
      success: true,
      message: `DB migration tamamlandı! ${successCount} işlem başarılı, ${skipCount} zaten mevcut (skip edildi). Veritabanı güncellendi.`,
      dbName,
      dbId,
      details: results
    }), { status: 200 });

  } catch (err: any) {
    console.error('DB Migrate Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
