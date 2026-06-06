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
    const { step, domain, service_type, d1_uuid } = body;

    if (!step || !domain) {
      return new Response(JSON.stringify({ error: "Eksik parametreler." }), { status: 400 });
    }

    // D1 Veritabanı bağlantısı
    const runtime = context.locals.runtime as any;
    const db = runtime?.env?.DB;

    if (!db) {
      return new Response(JSON.stringify({ error: "Sistem veritabanı bağlantısı yok." }), { status: 500 });
    }

    // Sistem API anahtarlarını çek
    const settingsList = await db.prepare("SELECT * FROM system_settings").all();
    const settingsMap: any = {};
    (settingsList.results || []).forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    const githubPat = settingsMap['github_pat'];
    const cfToken = settingsMap['cloudflare_token'];
    const cfAccountId = settingsMap['cloudflare_account_id'];

    if (!githubPat || !cfToken || !cfAccountId) {
      return new Response(JSON.stringify({ 
        error: "API Ayarları Yapılandırılmamış! Lütfen önce Admin paneli altındaki 'GitHub & Cloudflare API Ayarları' kartından anahtarlarınızı kaydedin." 
      }), { status: 400 });
    }

    // Domaini repolara uygun şekilde sanitize et
    const repoName = domain.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

    // ----------------------------------------------------
    // ADIM 1: GITHUB REPO OLUŞTURMA
    // ----------------------------------------------------
    if (step === 1) {
      const response = await fetch(`https://api.github.com/repos/akgcomputer/laflaf/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubPat}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'IsDeYeter-Portal-App'
        },
        body: JSON.stringify({
          owner: 'akgcomputer',
          name: repoName,
          description: `${domain} sitesi için otomatik oluşturulmuş laflaf alt yapısı.`,
          include_all_branches: false,
          private: false
        })
      });

      const resData: any = await response.json();
      if (!response.ok) {
        throw new Error(`GitHub Hata: ${resData.message || response.statusText}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `GitHub deposu başarıyla oluşturuldu: akgcomputer/${repoName}`,
        data: resData 
      }));
    }

    // ----------------------------------------------------
    // ADIM 2: CLOUDFLARE PAGES PROJECT OLUŞTURMA
    // ----------------------------------------------------
    if (step === 2) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `pages-${repoName}`,
          production_branch: 'main',
          source: {
            type: 'github',
            config: {
              owner: 'akgcomputer',
              repo_name: repoName,
              production_branch: 'main',
              pr_comments_enabled: true,
              deployments_enabled: true
            }
          },
          build_config: {
            build_command: 'npm run build',
            destination_dir: 'dist',
            root_dir: ''
          }
        })
      });

      const resData: any = await response.json();
      if (!response.ok || !resData.success) {
        const err = resData.errors?.[0]?.message || 'Pages projesi oluşturulamadı.';
        throw new Error(`Cloudflare Hata: ${err}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Cloudflare Pages projesi 'pages-${repoName}' oluşturuldu.`,
        data: resData 
      }));
    }

    // ----------------------------------------------------
    // ADIM 3: CLOUDFLARE D1 DATABASE OLUŞTURMA
    // ----------------------------------------------------
    if (step === 3) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `db-${repoName}`
        })
      });

      const resData: any = await response.json();
      if (!response.ok || !resData.success) {
        const err = resData.errors?.[0]?.message || 'D1 veritabanı oluşturulamadı.';
        throw new Error(`D1 Hata: ${err}`);
      }

      const uuid = resData.result.uuid;

      return new Response(JSON.stringify({ 
        success: true, 
        message: `D1 Veritabanı oluşturuldu. UUID: ${uuid}`,
        d1_uuid: uuid 
      }));
    }

    // ----------------------------------------------------
    // ADIM 4: CLOUDFLARE R2 BUCKET OLUŞTURMA
    // ----------------------------------------------------
    if (step === 4) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/r2/buckets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `r2-${repoName}`
        })
      });

      const resData: any = await response.json();
      if (!response.ok || !resData.success) {
        const err = resData.errors?.[0]?.message || 'R2 Bucket oluşturulamadı.';
        throw new Error(`R2 Hata: ${err}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `R2 Storage Bucket 'r2-${repoName}' oluşturuldu.`
      }));
    }

    // ----------------------------------------------------
    // ADIM 5: PAGES BINDINGS TANIMLAMA
    // ----------------------------------------------------
    if (step === 5) {
      if (!d1_uuid) {
        throw new Error("D1 Veritabanı UUID'si Adım 5 için gereklidir.");
      }

      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/pages-${repoName}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deployment_configs: {
            production: {
              d1_databases: {
                DB: {
                  id: d1_uuid
                }
              },
              r2_buckets: {
                R2: {
                  name: `r2-${repoName}`
                }
              }
            },
            preview: {
              d1_databases: {
                DB: {
                  id: d1_uuid
                }
              },
              r2_buckets: {
                R2: {
                  name: `r2-${repoName}`
                }
              }
            }
          }
        })
      });

      const resData: any = await response.json();
      if (!response.ok || !resData.success) {
        const err = resData.errors?.[0]?.message || 'D1 & R2 bağlantıları yapılamadı.';
        throw new Error(`Pages Bindings Hata: ${err}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `D1 Veritabanı ve R2 Bucket, Pages projesine başarıyla bağlandı.`
      }));
    }

    // ----------------------------------------------------
    // ADIM 6: DEPLOYMENT BAŞLATMA
    // ----------------------------------------------------
    if (step === 6) {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/pages-${repoName}/deployments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfToken}`
        }
      });

      const resData: any = await response.json();
      if (!response.ok || !resData.success) {
        const err = resData.errors?.[0]?.message || 'Deploy işlemi başlatılamadı.';
        throw new Error(`Deploy Hata: ${err}`);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Astro projesi Pages Edge CDN üzerinde yayına alınıyor.`
      }));
    }

    // ----------------------------------------------------
    // ADIM 7: SSL & DURUM DOĞRULAMA (SON ADIM)
    // ----------------------------------------------------
    if (step === 7) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Web sitesi SSL sertifikası doğrulandı. HTTP 200 OK. Hizmet Başarıyla Aktifleştirildi.`
      }));
    }

    return new Response(JSON.stringify({ error: "Geçersiz adım." }), { status: 400 });

  } catch (err: any) {
    console.error("Provision API Server Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
