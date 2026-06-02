// src/pages/api/cdn/[...path].ts
import type { APIRoute } from 'astro';

export const prerender = false; // API rotası sunucu tarafında çalışmalıdır (SSR)

export const GET: APIRoute = async (context) => {
  const path = context.params.path;
  
  const runtime = context.locals.runtime as any;
  const r2 = runtime?.env?.R2; // Cloudflare R2 Bucket binding

  if (!r2 || !path) {
    return new Response("CDN Binding or Path is Missing", { status: 404 });
  }

  try {
    // R2 Bucket'ından dosyayı getir
    const object = await r2.get(path);

    if (!object) {
      return new Response("Asset Not Found in CDN", { status: 404 });
    }

    const headers = new Headers();
    // R2'de saklanan meta verileri (Content-Type vb.) HTTP başlığı olarak yaz
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // 1 Yıllık güçlü CDN önbelleği

    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch (e: any) {
    console.error("CDN Fetch Error:", e);
    return new Response("Internal CDN Error", { status: 500 });
  }
};
