import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır (SSR)

export const POST: APIRoute = async (context) => {
  try {
    // Admin yetki kontrolü
    const user = context.locals.user;
    if (!user || user.is_partner !== 2) {
      return new Response(JSON.stringify({ error: "Yetkisiz işlem." }), { status: 401 });
    }

    const body = await context.request.json();
    const { site_id } = body;

    if (!site_id) {
      return new Response(JSON.stringify({ error: "Hizmet kimliği belirtilmedi." }), { status: 400 });
    }

    // D1 Veritabanı bağlantısı
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: "Sistem veritabanı bağlantısı yok." }), { status: 500 });
    }

    // Hizmeti bul
    const site = await db.prepare("SELECT * FROM sites WHERE id = ?").bind(site_id).first();
    if (!site) {
      return new Response(JSON.stringify({ error: "Hizmet bulunamadı." }), { status: 404 });
    }

    // Sistem ayarlarından GitHub tokenını oku
    const settings = await db.prepare("SELECT * FROM system_settings WHERE key = 'github_pat'").first();
    const githubPat = settings?.value;

    if (!githubPat) {
      return new Response(JSON.stringify({ error: "GitHub API Token ayarlanmamış! Lütfen önce ayarlardan kaydedin." }), { status: 400 });
    }

    const repoName = site.domain.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    // 1. .github/workflows/sync-template.yml dosyasının varlığını kontrol et
    const workflowPath = '.github/workflows/sync-template.yml';
    const checkRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/contents/${workflowPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `token ${githubPat}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'IsDeYeter-Portal-App'
      }
    });

    const workflowYaml = `name: Sync Template
on:
  workflow_dispatch:

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout tenant repo
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Configure Git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Backup protected tenant files
        run: |
          mkdir -p /tmp/tenant-backup
          [ -f wrangler.toml ] && cp wrangler.toml /tmp/tenant-backup/wrangler.toml || true
          [ -f .github/workflows/sync-template.yml ] && mkdir -p /tmp/tenant-backup/.github/workflows && cp .github/workflows/sync-template.yml /tmp/tenant-backup/sync-template.yml || true
          [ -f .dev.vars ] && cp .dev.vars /tmp/tenant-backup/.dev.vars || true
          [ -f .env ] && cp .env /tmp/tenant-backup/.env || true

      - name: Fetch template files
        run: |
          git remote add template https://github.com/akgcomputer/laflaf.git || true
          git fetch template main --depth=1

      - name: Copy template files over tenant (excluding protected files)
        run: |
          # Get list of all files from template/main
          git ls-tree -r --name-only template/main | while read filepath; do
            # Skip protected tenant-specific files
            if [ "$filepath" = "wrangler.toml" ] || \
               [ "$filepath" = ".github/workflows/sync-template.yml" ] || \
               [ "$filepath" = ".dev.vars" ] || \
               [ "$filepath" = ".env" ]; then
              echo "SKIP (protected): $filepath"
              continue
            fi

            # Create parent directory if needed
            dir=$(dirname "$filepath")
            [ "$dir" != "." ] && mkdir -p "$dir" || true

            # Copy file from template
            git show "template/main:$filepath" > "$filepath" 2>/dev/null && echo "COPIED: $filepath" || echo "WARN: could not copy $filepath"
          done

      - name: Restore protected tenant files
        run: |
          [ -f /tmp/tenant-backup/wrangler.toml ] && cp /tmp/tenant-backup/wrangler.toml wrangler.toml || true
          [ -f /tmp/tenant-backup/sync-template.yml ] && cp /tmp/tenant-backup/sync-template.yml .github/workflows/sync-template.yml || true
          [ -f /tmp/tenant-backup/.dev.vars ] && cp /tmp/tenant-backup/.dev.vars .dev.vars || true
          [ -f /tmp/tenant-backup/.env ] && cp /tmp/tenant-backup/.env .env || true

      - name: Run DB migrations (add missing columns safely)
        run: |
          npm install -g wrangler@latest 2>/dev/null || true
          DB_NAME=$(grep -oP '(?<=database_name = ")[^"]+' wrangler.toml | head -1)
          if [ -z "$DB_NAME" ]; then
            echo "Could not determine DB name, skipping migration."
            exit 0
          fi
          echo "Running migrations on D1 database: $DB_NAME"
          w() { wrangler d1 execute "$DB_NAME" --remote --command="$1" 2>/dev/null || true; }

          # categories
          w "ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'blog';" || true
          w "ALTER TABLE categories ADD COLUMN image_url TEXT;" || true
          w "CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, logo_url TEXT, is_popular INTEGER DEFAULT 0, createdAt TEXT NOT NULL);" || true

          # products table
          w "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL, brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, excerpt TEXT, description TEXT, price REAL NOT NULL DEFAULT 0, compare_at_price REAL, image_url TEXT, badge_top_left TEXT, badge_top_right TEXT, rating REAL DEFAULT 0, review_count INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'aktif', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);" || true
          w "ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'Adet';" || true
          w "ALTER TABLE products ADD COLUMN min_order_qty INTEGER DEFAULT 1;" || true
          w "ALTER TABLE products ADD COLUMN payment_options TEXT;" || true
          w "ALTER TABLE products ADD COLUMN gallery_images TEXT;" || true
          w "ALTER TABLE products ADD COLUMN badges TEXT;" || true
          w "ALTER TABLE products ADD COLUMN shipping_time TEXT;" || true
          w "ALTER TABLE products ADD COLUMN seller_name TEXT;" || true
          w "ALTER TABLE products ADD COLUMN features TEXT;" || true
          w "ALTER TABLE products ADD COLUMN tags TEXT;" || true
          w "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10;" || true
          w "ALTER TABLE products ADD COLUMN video_url TEXT;" || true
          w "ALTER TABLE products ADD COLUMN allow_backorder BOOLEAN DEFAULT 0;" || true
          w "ALTER TABLE products ADD COLUMN likes INTEGER DEFAULT 0;" || true
          w "ALTER TABLE products ADD COLUMN currency TEXT DEFAULT '₺';" || true
          w "ALTER TABLE products ADD COLUMN updatedAt TEXT;" || true

          # variants
          w "CREATE TABLE IF NOT EXISTS product_variants (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, name TEXT NOT NULL, sku TEXT, price REAL, stock INTEGER DEFAULT 0, image_url TEXT, createdAt TEXT NOT NULL);" || true

          # wholesale_prices
          w "CREATE TABLE IF NOT EXISTS wholesale_prices (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, min_qty INTEGER NOT NULL, discount_percentage REAL NOT NULL DEFAULT 0, createdAt TEXT NOT NULL);" || true
          w "ALTER TABLE wholesale_prices ADD COLUMN discount_percentage REAL DEFAULT 0;" || true

          # badges, reviews, qa, ecommerce_settings
          w "CREATE TABLE IF NOT EXISTS badges (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, bg_color TEXT, text_color TEXT, createdAt DATETIME);" || true
          w "CREATE TABLE IF NOT EXISTS product_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, user_name TEXT NOT NULL, rating INTEGER NOT NULL, comment TEXT, likes INTEGER DEFAULT 0, dislikes INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL);" || true
          w "CREATE TABLE IF NOT EXISTS product_qa (id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER REFERENCES products(id) ON DELETE CASCADE, user_name TEXT NOT NULL, question TEXT NOT NULL, answer TEXT, status TEXT NOT NULL DEFAULT 'pending', createdAt TEXT NOT NULL);" || true
          w "CREATE TABLE IF NOT EXISTS ecommerce_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT, createdAt TEXT, updatedAt TEXT);" || true

          echo "DB migration complete."
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Commit and push if there are changes
        run: |
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit — template is already up-to-date."
          else
            git commit -m "chore: sync with template repository and run migrations"
            git push origin main
            echo "Changes pushed successfully."
          fi
`;

    const base64Content = btoa(unescape(encodeURIComponent(workflowYaml)));

    let needUpdate = false;
    let existingSha: string | undefined = undefined;

    if (checkRes.status === 200) {
      const existingData = await checkRes.json();
      existingSha = existingData.sha;
      const decodedContent = decodeURIComponent(escape(atob(existingData.content.replace(/\s/g, ''))));
      if (decodedContent.trim() !== workflowYaml.trim()) {
        needUpdate = true;
      }
    } else if (checkRes.status === 404) {
      needUpdate = true;
    } else {
      const errData = await checkRes.json().catch(() => ({}));
      throw new Error(`Senkronizasyon dosyası kontrol edilemedi: ${errData.message || checkRes.statusText}`);
    }

    if (needUpdate) {
      const createRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/contents/${workflowPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubPat}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'IsDeYeter-Portal-App'
        },
        body: JSON.stringify({
          message: 'chore: update sync-template workflow with robust merge conflict handling',
          content: base64Content,
          sha: existingSha
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(`Senkronizasyon dosyası güncellenemedi: ${createData.message}`);
      }
      
      // Wait a moment for GitHub to process the workflow update commit before dispatching
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 2. Workflow'u tetikle (Workflow Dispatch)
    const triggerRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/actions/workflows/sync-template.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubPat}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'IsDeYeter-Portal-App'
      },
      body: JSON.stringify({
        ref: 'main'
      })
    });

    if (triggerRes.status === 204 || triggerRes.status === 201 || triggerRes.status === 200) {
      return new Response(JSON.stringify({
        success: true,
        message: `Güncelleme başarıyla tetiklendi! GitHub Actions arka planda kod güncellemesini yapıyor. Birkaç dakika içinde siteniz otomatik olarak güncellenecektir.`
      }));
    } else {
      const errData = await triggerRes.json().catch(() => ({}));
      throw new Error(`Güncelleme tetiklenemedi: ${errData.message || triggerRes.statusText}`);
    }

  } catch (err: any) {
    console.error("Sync Template Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
