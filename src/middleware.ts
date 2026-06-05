// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { ensureDatabaseSetup } from './utils/db-init';

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const url = new URL(context.request.url);
    const pathname = url.pathname;

    // Static dosyaların, resimlerin, CSS/JS ve API auth rotalarının taranmasını atla
    if (
      pathname.startsWith('/_astro') || 
      pathname.startsWith('/img') || 
      pathname.startsWith('/css') || 
      pathname.startsWith('/js') || 
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/api/auth')
    ) {
      return next();
    }

    // 1. D1 Veritabanı ve Oturum Kontrolü
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (db) {
      try {
        await ensureDatabaseSetup(db);
      } catch (e) {
        console.error("❌ Middleware D1 Setup Error:", e);
      }
    }

    let user: any = null;
    const sessionToken = context.cookies.get('session_token')?.value;

    if (sessionToken && db) {
      try {
        // Veritabanından geçerli oturum ve kullanıcıyı getir
        const session = await db.prepare(
          "SELECT u.* FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > ?"
        ).bind(sessionToken, Math.floor(Date.now() / 1000)).first();

        if (session) {
          user = session;
          // Tüm sayfalardan (Astro.locals.user) olarak erişebilmek için inject edelim
          context.locals.user = user;
        } else {
          // Oturum süresi dolmuşsa çerezleri temizle
          context.cookies.delete('session_token', { path: '/' });
        }
      } catch (e) {
        console.error("Middleware D1 Session Error:", e);
      }
    }

    // 2. Rol Tabanlı Rota İzolasyon Kontrolleri (Panel Güvenliği)

    // A. Üye Paneli Koruması (/dashboard/member/*)
    if (pathname.startsWith('/dashboard/member')) {
      if (!user) {
        return context.redirect('/login?error=unauthorized');
      }
      if (user.is_partner === 1) {
        // İş ortağı üye paneline girmeye çalışırsa kendi paneline fırlat
        return context.redirect('/dashboard/partner');
      }
      if (user.is_partner === 2) {
        return context.redirect('/admin');
      }
    }

    // B. İş Ortağı Paneli Koruması (/dashboard/partner/*)
    if (pathname.startsWith('/dashboard/partner')) {
      if (!user) {
        return context.redirect('/login?error=unauthorized');
      }
      if (user.is_partner === 0) {
        // Sıradan üye iş ortağı paneline girmeye çalışırsa kendi paneline fırlat
        return context.redirect('/dashboard/member');
      }
      if (user.is_partner === 2) {
        return context.redirect('/admin');
      }
    }

    // C. Admin Paneli Koruması (/admin*)
    if (pathname.startsWith('/admin')) {
      if (!user) {
        return context.redirect('/login?error=unauthorized');
      }
      if (user.is_partner !== 2) {
        // Admin olmayanları rollerine göre panellerine geri püskürt
        if (user.is_partner === 1) {
          return context.redirect('/dashboard/partner');
        } else {
          return context.redirect('/dashboard/member');
        }
      }
    }

    // D. Onboarding Sihirbazı Koruması (/onboarding)
    if (pathname.startsWith('/onboarding')) {
      if (!user) {
        return context.redirect('/login?error=unauthorized');
      }
      if (user.is_partner !== 1) {
        // İş ortağı olmayanlar onboarding yapamaz
        if (user.is_partner === 2) {
          return context.redirect('/admin');
        } else {
          return context.redirect('/dashboard/member');
        }
      }
    }
  } catch (err) {
    console.error("❌ CRITICAL MIDDLEWARE ERROR:", err);
  }

  // Her şey yolundaysa veya hata alınırsa isteğin çalışmasına izin ver
  return next();
});
