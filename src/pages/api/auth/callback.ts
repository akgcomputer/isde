// src/pages/api/auth/callback.ts
import type { APIRoute } from 'astro';
import { ensureDatabaseSetup } from '../../../utils/db-init';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');

  if (!code || !stateParam) {
    return context.redirect('/login?error=missing_auth_params');
  }

  // State çözümlemesi (base64 decode)
  let provider = 'google';
  let role = 'member';
  try {
    const decodedState = JSON.parse(atob(stateParam));
    provider = decodedState.provider;
    role = decodedState.role;
  } catch (e) {
    return context.redirect('/login?error=invalid_state');
  }

  // D1 Veritabanı bağlantısı
  const runtime = context.locals.runtime as any;
  const db = runtime?.env?.DB;

  if (!db) {
    return new Response("Cloudflare D1 Database binding is missing! Please configure it.", { status: 500 });
  }

  await ensureDatabaseSetup(db);

  // Kullanıcı bilgileri tanımlayıcıları
  let userId = '';
  let userEmail = '';
  let userName = '';

  const isMock = code === 'mock-auth-code-123456';

  if (isMock) {
    // 1. Mock Giriş Durumu (Geliştirici için yerel test)
    userId = `mock-${provider}-${role}-999`;
    userEmail = `test-${role}@isdeyeter.com`;
    userName = role === 'partner' ? "Örnek İş Ortağı A.Ş." : "Ahmet Müşteri";
  } else {
    // 2. Canlı OAuth Giriş Durumu (Üretim ortamı / Production)
    const host = url.host;
    const protocol = url.protocol;
    const redirectUri = `${protocol}//${host}/api/auth/callback`;

    try {
      if (provider === 'google') {
        const clientId = runtime.env.GOOGLE_CLIENT_ID;
        const clientSecret = runtime.env.GOOGLE_CLIENT_SECRET;

        // Token Değiş Tokuşu
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        const tokenData = await tokenResponse.json() as any;
        if (!tokenResponse.ok) {
          throw new Error(tokenData.error_description || 'Google token exchange failed');
        }

        // Kullanıcı Profil Bilgilerini Çek
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const userData = await userResponse.json() as any;
        
        userId = `google-${userData.id}`;
        userEmail = userData.email;
        userName = userData.name || userData.email.split('@')[0];
      } else {
        // Facebook ve Apple entegrasyonları için genel hata korumalı blok
        return context.redirect('/login?error=provider_not_implemented');
      }
    } catch (err: any) {
      console.error("OAuth Callback Error:", err);
      return context.redirect(`/login?error=oauth_failed&message=${encodeURIComponent(err.message)}`);
    }
  }

  // 3. D1 Veritabanı Kayıt / Güncelleme (Upsert) İşlemi
  try {
    // Kullanıcı mevcut mu kontrol et
    const existingUser = await db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();

    const isPartnerValue = role === 'partner' ? 1 : 0;

    if (!existingUser) {
      // Yeni Kullanıcı Ekle
      await db.prepare(
        "INSERT INTO users (id, email, name, is_partner) VALUES (?, ?, ?, ?)"
      ).bind(userId, userEmail, userName, isPartnerValue).run();
      console.log(`Yeni kullanıcı başarıyla veritabanına eklendi: ${userEmail} (${role})`);
    } else {
      // Mevcut Kullanıcının adını/mailini güncelle ama rolüne dokunma (is_partner korunur)
      await db.prepare(
        "UPDATE users SET email = ?, name = ? WHERE id = ?"
      ).bind(userEmail, userName, userId).run();
      console.log(`Mevcut kullanıcı giriş yaptı, verileri güncellendi: ${userEmail}`);
    }

    // 4. Güvenli Oturum (Session) Oluşturma
    const sessionToken = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7 Günlük oturum

    await db.prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionToken, userId, expiresAt).run();

    // 5. Secure Session Cookie Ayarlama
    context.cookies.set('session_token', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 Gün (saniye cinsinden)
    });

    // 6. Rol Kontrolü ve Yönlendirme
    // D1'den güncel kullanıcı rolünü çekelim
    const user = await db.prepare("SELECT is_partner FROM users WHERE id = ?").bind(userId).first() as any;

    if (user.is_partner === 1) {
      // İş Ortağı ise uzmanlık alanlarını kontrol et
      const services = await db.prepare("SELECT * FROM partner_services WHERE partner_id = ?").bind(userId).all();
      if (!services.results || services.results.length === 0) {
        // Uzmanlık alanı seçmemişse onboarding sihirbazına yönlendir
        return context.redirect('/onboarding');
      }
      return context.redirect('/dashboard/partner');
    } else if (user.is_partner === 2) {
      // Admin ise admin paneline yönlendir
      return context.redirect('/admin');
    } else {
      // Standart Üye ise müşteri paneline yönlendir
      return context.redirect('/dashboard/member');
    }

  } catch (dbErr) {
    console.error("D1 Database Login Error:", dbErr);
    return context.redirect('/login?error=db_error');
  }
};
