// src/pages/api/auth/classic-register.ts
import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır (SSR)

export const POST: APIRoute = async (context) => {
  try {
    const formData = await context.request.formData();
    const name = formData.get('name')?.toString().trim();
    const phone = formData.get('phone')?.toString().trim();
    const emailInput = formData.get('email')?.toString().trim();
    const passwordInput = formData.get('password')?.toString();
    const role = formData.get('role')?.toString() || 'member'; // 'member' veya 'partner'

    if (!name || !phone) {
      return context.redirect('/login?error=missing_required_fields');
    }

    // D1 Veritabanı bağlantısı
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response("Cloudflare D1 Database binding is missing!", { status: 500 });
    }

    // Telefon veya e-posta ile zaten kayıtlı bir kullanıcı var mı kontrol et
    let existingUser = await db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first();
    if (existingUser) {
      return context.redirect('/login?error=phone_already_registered');
    }

    if (emailInput) {
      existingUser = await db.prepare("SELECT * FROM users WHERE email = ?").bind(emailInput).first();
      if (existingUser) {
        return context.redirect('/login?error=email_already_registered');
      }
    }

    // Benzersiz Kullanıcı Kimliği oluştur
    const userId = `classic-${crypto.randomUUID()}`;
    const isPartnerValue = role === 'partner' ? 1 : 0;
    
    // E-posta adresi girilmediyse benzersiz bir yedek e-posta adresi üretiyoruz 
    // (Kullanıcılar tablosunda email alanı UNIQUE NOT NULL olduğu için veritabanı kuralını çiğnememek adına)
    const email = emailInput || `${phone}@isdeyeter.com`;
    const password = passwordInput || "123456"; // Boş bırakılırsa varsayılan şifre

    // Kullanıcıyı veritabanına kaydet
    // Tabloda 'password' kolonu olmalı. Yoksa SQL hatası verecektir (Kullanıcıya konsoldan ALTER TABLE çalıştırması hatırlatılacaktır)
    await db.prepare(
      "INSERT INTO users (id, email, name, is_partner, phone, password) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, email, name, isPartnerValue, phone, password).run();

    console.log(`Klasik yeni kayıt oluşturuldu: ${name} (${phone}) - Rol: ${role}`);

    // Başarılı Kayıt: Oturum (Session) Oluşturma
    const sessionToken = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Günlük oturum

    await db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionToken, userId, expiresAt).run();

    // Secure Session Cookie Ayarlama
    context.cookies.set('session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 Gün (saniye cinsinden)
    });

    // Yönlendirme
    if (isPartnerValue === 1) {
      return context.redirect('/onboarding');
    } else {
      return context.redirect('/dashboard/member');
    }

  } catch (err: any) {
    console.error("Classic Register Server Error:", err);
    return context.redirect(`/login?error=server_error&message=${encodeURIComponent(err.message)}`);
  }
};
