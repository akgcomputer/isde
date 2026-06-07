import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır (SSR)

export const GET: APIRoute = async (context) => {
  try {
    // Admin yetki kontrolü
    const user = context.locals.user;
    if (!user || user.is_partner !== 2) {
      return new Response(JSON.stringify({ error: "Yetkisiz işlem." }), { status: 401 });
    }

    const domain = context.url.searchParams.get('domain')?.trim().toLowerCase();
    if (!domain) {
      return new Response(JSON.stringify({ error: "Alan adı parametresi eksik." }), { status: 400 });
    }

    // D1 Veritabanı bağlantısı
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: "Sistem veritabanı bağlantısı yok." }), { status: 500 });
    }

    // Domain çakışma kontrolü
    const existing = await db.prepare("SELECT id FROM sites WHERE domain = ?").bind(domain).first();

    return new Response(JSON.stringify({ exists: !!existing }));
  } catch (err: any) {
    console.error("Check domain API error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
