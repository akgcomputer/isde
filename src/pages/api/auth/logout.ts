// src/pages/api/auth/logout.ts
import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır

export const GET: APIRoute = async (context) => {
  const sessionToken = context.cookies.get('session_token')?.value;

  if (sessionToken) {
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (db) {
      try {
        // Oturumu D1 veritabanından sil
        await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionToken).run();
        console.log("Oturum veritabanından başarıyla temizlendi.");
      } catch (e) {
        console.error("Oturum silinirken D1 hatası oluştu:", e);
      }
    }

    // Cookie'yi sil
    context.cookies.delete('session_token', { path: '/' });
  }

  // Ana sayfaya yönlendir
  return context.redirect('/');
};
export const POST = GET; // Hem GET hem POST isteklerine yanıt versin
