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

      - name: Commit and push if there are changes
        run: |
          git add -A
          if git diff --staged --quiet; then
            echo "No changes to commit — template is already up-to-date."
          else
            git commit -m "chore: sync with template repository [skip ci]"
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
