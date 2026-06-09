// src/pages/api/auth/classic-login.ts
import type { APIRoute } from 'astro';
import { ensureDatabaseSetup } from '../../../utils/db-init';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır (SSR)

export const POST: APIRoute = async (context) => {
  try {
    const formData = await context.request.formData();
    const identifier = formData.get('identifier')?.toString().trim();
    const password = formData.get('password')?.toString();
    const role = formData.get('role')?.toString() || 'member'; // 'member' veya 'partner'

    if (!identifier || !password) {
      return context.redirect('/login?error=missing_fields');
    }

    // D1 Veritabanı bağlantısı
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response("Cloudflare D1 Database binding is missing!", { status: 500 });
    }

    await ensureDatabaseSetup(db);

    // E-posta veya Telefon numarası ile kullanıcıyı sorgula
    // Hem email hem de phone kolonlarından eşleşme arıyoruz
    const user = await db.prepare(
      "SELECT * FROM users WHERE email = ? OR phone = ?"
    ).bind(identifier, identifier).first() as any;

    if (!user) {
      console.warn(`Giriş başarısız: Kullanıcı bulunamadı (${identifier})`);
      return context.redirect('/login?error=user_not_found');
    }

    // Şifre kontrolü
    // NOT: Kullanıcı "admin@isdeyeter.com500" gibi özel bir şifre talep ettiği için şifreyi kontrol ediyoruz.
    // Eğer şifre alanı boşsa veya eşleşmiyorsa hata döndür.
    const dbPassword = user.password || "123456"; // Şifresiz kayıtlar için varsayılan şifre
    if (dbPassword !== password) {
      console.warn(`Giriş başarısız: Yanlış şifre (${identifier})`);
      return context.redirect('/login?error=wrong_password');
    }

    // Başarılı Giriş: Oturum (Session) Oluşturma
    const sessionToken = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Günlük oturum

    await db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionToken, user.id, expiresAt).run();

    // Secure Session Cookie Ayarlama
    context.cookies.set('session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 Gün (saniye cinsinden)
    });

    console.log(`Klasik giriş başarılı: ${user.email || user.phone} (Rol: ${user.is_partner})`);

    // Yönlendirme
    if (user.is_partner === 1) {
      // İş Ortağı ise uzmanlık alanlarını kontrol et
      const services = await db.prepare("SELECT * FROM partner_services WHERE partner_id = ?").bind(user.id).all();
      if (!services.results || services.results.length === 0) {
        return context.redirect('/onboarding');
      }
      return context.redirect('/business');
    } else if (user.is_partner === 2) {
      // Admin ise admin paneline yönlendir
      return context.redirect('/admin');
    } else {
      // Standart Üye ise müşteri paneline yönlendir
      return context.redirect('/user');
    }

  } catch (err: any) {
    console.error("Classic Login Server Error:", err);
    return context.redirect(`/login?error=server_error&message=${encodeURIComponent(err.message)}`);
  }
};

