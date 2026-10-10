// Serves /sitemap.xml (rewritten in vercel.json). Lists the public pages plus every active product,
// read live from Supabase so new products appear for search engines without a redeploy.

const SITE = (process.env.SITE_URL || 'https://vi-medics.vercel.app').replace(/\/$/, '');

type Row = { id: string; created_at?: string };

const urlEntry = (path: string, changefreq: string, priority: string, lastmod?: string) =>
  `  <url><loc>${SITE}${path === '/' ? '' : path}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

export async function GET(): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const entries = [urlEntry('/', 'weekly', '1.0'), urlEntry('/products', 'daily', '0.9'), urlEntry('/about', 'monthly', '0.4')];

  if (supabaseUrl && anonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/products?select=id,created_at&status=eq.active&order=created_at.desc`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as Row[];
        for (const r of rows) entries.push(urlEntry(`/product/${encodeURIComponent(r.id)}`, 'weekly', '0.8', r.created_at));
      }
    } catch {
      /* fall back to the static pages */
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
