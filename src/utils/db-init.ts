// src/utils/db-init.ts
// Veritabanı tablolarının otomatik oluşturulmasını sağlayan self-healing mekanizması

let dbInitialized = false;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_partner INTEGER DEFAULT 0,
    phone TEXT,
    password TEXT,
    address TEXT,
    billing_info TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_services (
    partner_id TEXT NOT NULL,
    service_category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (partner_id, service_category),
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    mode TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    partner_id TEXT NOT NULL,
    price REAL NOT NULL,
    duration TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES service_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_services_category ON partner_services(service_category);
CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(request_id);

INSERT OR IGNORE INTO users (id, email, name, is_partner, phone, password)
VALUES ('admin-user-id-999', 'admin@isdeyeter.com', 'Admin Yönetici', 2, '5325000999', 'admin@isdeyeter.com500');
`;

export async function ensureDatabaseSetup(db: any) {
  if (dbInitialized) return;

  try {
    // 1. Tabloların var olup olmadığını hızlıca kontrol et (Maks 0.5ms sürer)
    const checkTable = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    ).first();

    // 2. Eğer sessions tablosu mevcutsa, veritabanı zaten kurulmuştur
    if (checkTable) {
      dbInitialized = true;
      console.log("⚡ D1 Veritabanı tabloları mevcut, doğrulandı.");
      return;
    }

    // 3. Tablo yoksa, şemayı otomatik olarak kur (Self-Healing)
    console.log("🛠️ D1 Veritabanı tabloları bulunamadı. Otomatik kurulum başlatılıyor...");
    await db.exec(SCHEMA_SQL);
    dbInitialized = true;
    console.log("✅ D1 Veritabanı tabloları ve varsayılan Admin hesabı başarıyla otomatik kuruldu.");
  } catch (err) {
    console.error("❌ D1 Otomatik Kurulum Hatası (Self-Healing Failed):", err);
  }
}
