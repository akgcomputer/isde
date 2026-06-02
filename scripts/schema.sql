-- SQL Schema for Cloudflare D1 Database - İş De Yeter Platform

-- 1. Kullanıcılar Tablosu (Üye, İş Ortağı, Admin)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- UUID veya Social Login ID (Google, Facebook vb.)
    email TEXT UNIQUE NOT NULL,                -- E-posta adresi
    name TEXT NOT NULL,                        -- Ad Soyadı / Firma Adı
    is_partner INTEGER DEFAULT 0,              -- Rol: 0 = Üye (Müşteri), 1 = İş Ortağı, 2 = Admin
    phone TEXT,                                -- Telefon numarası
    address TEXT,                              -- Adres bilgisi
    billing_info TEXT,                         -- Fatura / Vergi bilgileri
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Oturumlar (Session) Tablosu (Güvenli cookie oturum yönetimi için)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                       -- Session token
    user_id TEXT NOT NULL,                     -- users.id referansı
    expires_at INTEGER NOT NULL,               -- Unix timestamp son kullanma tarihi
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. İş Ortağı Hizmet Tablosu (İş ortaklarının seçtiği uzmanlık kolları - maks 5 adet)
CREATE TABLE IF NOT EXISTS partner_services (
    partner_id TEXT NOT NULL,                  -- users.id referansı (is_partner = 1 olmalı)
    service_category TEXT NOT NULL,            -- Seçilen hizmet dalı (Örn: 'Tadilat: Boya Badana')
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (partner_id, service_category),
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Ücretsiz Web Siteleri Tablosu (laflaf.net altyapılı)
CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                     -- Web sitesini kuran üyenin ID'si
    domain TEXT UNIQUE NOT NULL,               -- Kurulan alan adı (Örn: 'modam.laflaf.net')
    mode TEXT NOT NULL,                        -- Mod seçimi ('hizmet' veya 'urun')
    status TEXT DEFAULT 'PENDING',             -- Durum: 'PENDING', 'ACTIVE', 'SUSPENDED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Hizmet Talepleri / İlanları Tablosu
CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,                   -- Talebi açan müşterinin ID'si
    category TEXT NOT NULL,                    -- Hizmet kategorisi (Örn: 'Temizlik: Ev Temizliği')
    title TEXT NOT NULL,                       -- Talep başlığı
    description TEXT NOT NULL,                 -- Talep detay açıklaması
    image_url TEXT,                            -- R2 cdn/bucket görsel adresi (isteğe bağlı)
    status TEXT DEFAULT 'PENDING',             -- Durum: 'PENDING', 'OFFER_RECEIVED', 'ACCEPTED', 'REJECTED', 'COMPLETED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Teklifler Tablosu (İş ortaklarının taleplere verdiği teklifler)
CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,               -- service_requests.id referansı
    partner_id TEXT NOT NULL,                  -- Teklif veren iş ortağının ID'si
    price REAL NOT NULL,                       -- Teklif edilen fiyat (TL)
    duration TEXT NOT NULL,                    -- Teklif edilen tamamlanma süresi (Örn: '2 Gün')
    status TEXT DEFAULT 'PENDING',             -- Teklif durumu: 'PENDING', 'ACCEPTED', 'REJECTED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Kolay arama ve performans için indeksler
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_services_category ON partner_services(service_category);
CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(request_id);
