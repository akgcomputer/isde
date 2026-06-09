import type { APIRoute } from 'astro';
export const GET: APIRoute = async ({ locals }) => {
  try {
    const runtime = locals.runtime as any;
    const db = runtime?.env?.DB;
    if (!db) return new Response('No DB', { status: 500 });
    const row = await db.prepare("SELECT value FROM system_settings WHERE key = 'github_pat'").first();
    return new Response(JSON.stringify({ pat: row?.value }), { status: 200 });
  } catch (err: any) {
    return new Response(err.message, { status: 500 });
  }
};
