/**
 * Taobao Link Fixer — core logic.
 *
 * Taobao/Tmall links come in several shapes:
 *   - https://item.taobao.com/item.htm?id=925435367253        (already correct)
 *   - https://detail.tmall.com/item.htm?id=925435367253        (tmall, same id param)
 *   - https://world.taobao.com/item/<opaque-token>.htm         (cross-border storefront —
 *        the token is NOT a reversible encoding of the id, it's an internal opaque slug)
 *
 * Strategy:
 *   1. Try to pull a numeric id straight out of the URL (query param or path). Cheap,
 *      works for the majority of link shapes, no network call.
 *   2. If that fails (the world.taobao.com opaque-token case), fetch the live page
 *      through a public CORS proxy and regex the real item.taobao.com link out of the
 *      rendered HTML — the storefront always embeds it for tracking/cross-links.
 *
 * Step 2 only works once this page is actually served over http(s) (e.g. GitHub Pages),
 * since it needs cross-origin fetch. It will not work from a `file://` page.
 */

const CANONICAL_BASE = "https://item.taobao.com/item.htm?id=";

// Tried in order; first one that returns a usable id wins.
const CORS_PROXIES = [
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const ID_PATTERNS_IN_HTML = [
  /item\.taobao\.com\/item\.htm\?id=(\d{6,15})/,
  /detail\.tmall\.com\/item\.htm\?id=(\d{6,15})/,
  /"itemId"\s*:\s*"?(\d{6,15})"?/,
];

/** Try to extract a numeric item id directly from the URL string. No network. */
function extractIdFromUrlDirect(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl.trim());
  } catch (e) {
    return null;
  }

  const idParam = u.searchParams.get("id");
  if (idParam && /^\d{6,15}$/.test(idParam)) return idParam;

  // Mobile-style path: /item/<digits>.htm
  const pathMatch = u.pathname.match(/\/item\/(\d{6,15})\.htm/);
  if (pathMatch) return pathMatch[1];

  return null;
}

/** Fetch the page through a CORS proxy and pull the id out of the embedded links/JSON. */
async function extractIdViaFetch(rawUrl, { timeoutMs = 12000 } = {}) {
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(buildProxyUrl(rawUrl), { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;

      const html = await resp.text();
      for (const pattern of ID_PATTERNS_IN_HTML) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
    } catch (e) {
      // try next proxy
    }
  }
  return null;
}

/**
 * Resolve one raw link to a { id, fixedUrl, method } result, or throw with a
 * human-readable reason if nothing could be extracted.
 */
async function fixTaobaoLink(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error("Empty link");

  const directId = extractIdFromUrlDirect(trimmed);
  if (directId) {
    return { id: directId, fixedUrl: CANONICAL_BASE + directId, method: "direct" };
  }

  const fetchedId = await extractIdViaFetch(trimmed);
  if (fetchedId) {
    return { id: fetchedId, fixedUrl: CANONICAL_BASE + fetchedId, method: "fetched" };
  }

  throw new Error(
    "Couldn't find an item id — the page may block the CORS proxy. Try opening the link and copying the item id manually."
  );
}
