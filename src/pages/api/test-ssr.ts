// src/pages/api/test-ssr.ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  return new Response(JSON.stringify({ 
    status: "ok", 
    message: "Astro SSR API works!",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
};
