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
        'Authorization': `Bearer ${githubPat}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'IsDeYeter-Portal-App'
      }
    });

    // Eğer workflow dosyası yoksa (404), oluştur
    if (checkRes.status === 404) {
      const workflowYaml = `name: Sync Template
on:
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Configure Git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
      - name: Add template remote
        run: git remote add template https://github.com/akgcomputer/laflaf.git
      - name: Fetch template
        run: git fetch template main
      - name: Merge template
        run: |
          git merge template/main --allow-unrelated-histories -m "chore: sync with template repository"
      - name: Push changes
        run: git push origin main
`;

      const base64Content = btoa(unescape(encodeURIComponent(workflowYaml)));

      const createRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/contents/${workflowPath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubPat}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'IsDeYeter-Portal-App'
        },
        body: JSON.stringify({
          message: 'chore: add sync-template workflow',
          content: base64Content
        })
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(`Senkronizasyon dosyası oluşturulamadı: ${createData.message}`);
      }
    }

    // 2. Workflow'u tetikle (Workflow Dispatch)
    const triggerRes = await fetch(`https://api.github.com/repos/akgcomputer/${repoName}/actions/workflows/sync-template.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubPat}`,
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
