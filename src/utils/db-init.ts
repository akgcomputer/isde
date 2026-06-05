// src/utils/db-init.ts
// Robust veritabanı tablolarının otomatik oluşturulmasını ve güncellenmesini sağlayan self-healing mekanizması

let dbInitialized = false;

export async function ensureDatabaseSetup(db: any) {
  if (dbInitialized) return;

  try {
    console.log("🔍 D1 Veritabanı yapısı doğrulanıyor...");

    // 1. users tablosunu oluştur (eğer yoksa)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          is_partner INTEGER DEFAULT 0,
          phone TEXT,
          address TEXT,
          billing_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. password sütununun var olup olmadığını kontrol et, yoksa ekle (Migration)
    try {
      const info = await db.prepare("PRAGMA table_info(users)").all();
      if (info && info.results) {
        const hasPassword = info.results.some((col: any) => col.name === 'password');
        if (!hasPassword) {
          await db.prepare("ALTER TABLE users ADD COLUMN password TEXT").run();
          console.log("✅ 'users' tablosuna 'password' sütunu eklendi.");
        }
      }
    } catch (colErr) {
      console.error("❌ 'users' tablosu kolon kontrolü sırasında hata:", colErr);
    }

    // 3. sessions tablosunu oluştur
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    // 4. partner_services tablosunu oluştur
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS partner_services (
          partner_id TEXT NOT NULL,
          service_category TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (partner_id, service_category),
          FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    // 5. sites tablosunu oluştur
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          domain TEXT UNIQUE NOT NULL,
          mode TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    // 6. service_requests tablosunu oluştur
    await db.prepare(`
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
      )
    `).run();

    // 7. offers tablosunu oluştur
    await db.prepare(`
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
      )
    `).run();

    // 8. İndeksleri tek tek oluştur
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
      "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_partner_services_category ON partner_services(service_category)",
      "CREATE INDEX IF NOT EXISTS idx_sites_user ON sites(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id)",
      "CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(request_id)"
    ];
    for (const idx of indexes) {
      await db.prepare(idx).run();
    }

    // 9. Admin kullanıcısını ekle veya güncelle
    await db.prepare(`
      INSERT OR REPLACE INTO users (id, email, name, is_partner, phone, password)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      'admin-user-id-999', 
      'admin@isdeyeter.com', 
      'Admin Yönetici', 
      2, 
      '5325000999', 
      'admin@isdeyeter.com500'
    ).run();

    dbInitialized = true;
    console.log("✅ D1 Veritabanı tabloları, indeksler ve Admin kullanıcısı başarıyla otomatik doğrulandı.");
  } catch (err: any) {
    console.error("❌ D1 Otomatik Yapılandırma Hatası (Self-Healing Failed):", err);
    throw new Error(`D1 Otomatik Yapılandırma Başarısız: ${err.message}`);
  }
}
