// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const provider = url.searchParams.get('provider') || 'google';
  const role = url.searchParams.get('role') || 'member'; // 'member' veya 'partner'

  const host = url.host;
  const protocol = url.protocol;
  const redirectUri = `${protocol}//${host}/api/auth/callback`;

  // State içerisine seçilen rol ve sağlayıcı bilgisini paketleyelim (güvenlik için base64)
  const stateData = {
    provider,
    role,
    nonce: Math.random().toString(36).substring(2, 15)
  };
  const state = btoa(JSON.stringify(stateData));

  // local development fallback için mock login mekanizması (Client ID / Secret ayarlanmadığında kolay test için)
  const runtime = context.locals.runtime as any;
  const isMock = !runtime?.env?.GOOGLE_CLIENT_ID; // Eğer env tanımlı değilse doğrudan mock callback tetikle

  if (isMock) {
    // Localhost testlerinde OAuth API anahtarları tanımlanmadan da hızlıca test edebilmek için Mock Giriş Simülasyonu
    const mockCallbackUrl = new URL(`${protocol}//${host}/api/auth/callback`);
    mockCallbackUrl.searchParams.set('code', 'mock-auth-code-123456');
    mockCallbackUrl.searchParams.set('state', state);
    return context.redirect(mockCallbackUrl.toString());
  }

  // Aktif sağlayıcıya göre OAuth yönlendirme URL'sini oluştur
  if (provider === 'google') {
    const clientId = runtime.env.GOOGLE_CLIENT_ID;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=openid%20profile%20email&` +
      `state=${encodeURIComponent(state)}&` +
      `prompt=select_account`;
    
    return context.redirect(authUrl);
  }

  if (provider === 'facebook') {
    const clientId = runtime.env.FACEBOOK_CLIENT_ID;
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${encodeURIComponent(state)}&` +
      `scope=email,public_profile`;

    return context.redirect(authUrl);
  }

  if (provider === 'apple') {
    const clientId = runtime.env.APPLE_CLIENT_ID;
    const authUrl = `https://appleid.apple.com/auth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `state=${encodeURIComponent(state)}&` +
      `scope=name%20email&` +
      `response_mode=form_post`;

    return context.redirect(authUrl);
  }

  // Varsayılan olarak login sayfasına geri gönder
  return context.redirect('/login?error=invalid_provider');
};
