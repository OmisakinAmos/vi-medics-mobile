import { useEffect } from 'react';

/** Public address of the site. Change VITE_SITE_URL (or this default) when a custom domain is added. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://vi-medics.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'Vi-Medics';
export const DEFAULT_IMAGE = 'https://raw.githubusercontent.com/OmisakinAmos/vi-medics-mobile/seo-marketing/public/og-image.png';

export type Seo = {
  title: string;
  description: string;
  /** Path such as "/products". Used for the canonical URL and og:url. */
  path: string;
  image?: string;
  /** Keep private/transactional pages (cart, checkout, account) out of search results. */
  noindex?: boolean;
  /** Structured data (schema.org) objects for this page. */
  jsonLd?: object[];
  type?: 'website' | 'product';
};

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Sets the document title, meta description, canonical URL, social tags and JSON-LD for the current page. */
export function useSeo(seo: Seo | null) {
  const key = seo ? JSON.stringify(seo) : '';
  useEffect(() => {
    if (!seo) return;
    const url = `${SITE_URL}${seo.path === '/' ? '' : seo.path}`;
    const image = seo.image ?? DEFAULT_IMAGE;
    document.title = seo.title;
    setMeta('name', 'description', seo.description);
    setMeta('name', 'robots', seo.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setCanonical(url || SITE_URL);
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:url', url || SITE_URL);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:type', seo.type === 'product' ? 'og:product' : 'website');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    setMeta('name', 'twitter:image', image);

    document.head.querySelectorAll('script[data-seo-jsonld]').forEach((n) => n.remove());
    (seo.jsonLd ?? []).forEach((obj) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-seo-jsonld', '');
      s.text = JSON.stringify(obj);
      document.head.appendChild(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${SITE_URL}${it.path === '/' ? '' : it.path}` })),
});
