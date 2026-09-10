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
 *      through a read-through proxy and regex the real item.taobao.com link out of the
 *      HTML — the storefront always embeds it internally for tracking/cross-links.
 *
 * Step 2 only works once this page is actually served over http(s) (e.g. GitHub Pages),
 * since it needs cross-origin fetch. It will not work from a `file://` page.
 *
 * Proxy notes (as of testing in Sept 2026):
 *   - corsproxy.io now requires a paid API key for server-to-server fetches — dropped.
 *   - api.allorigins.win / api.codetabs.com either time out or get blocked specifically
 *     when the target is world.taobao.com (Alibaba's anti-scraping appears to block their
 *     server IPs), even though they work fine against ordinary sites. Kept as last-resort
 *     fallbacks in case that changes.
 *   - r.jina.ai (Jina AI's "Reader" API, meant for fetching pages for LLM consumption)
 *     reliably got through and is used as the primary proxy. It's free without a key at
 *     a modest rate limit; see README for how to add a free API key if you hit that limit.
 */

const CANONICAL_BASE = "https://item.taobao.com/item.htm?id=";

// Tried in order; first one that returns a usable id wins.
const PROXIES = [
  {
    name: "jina",
    request: (url) => ({
      url: `https://r.jina.ai/${url}`,
      init: { headers: { "X-Return-Format": "html" } },
    }),
    timeoutMs: 15000,
  },
  {
    name: "allorigins",
    request: (url) => ({
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      init: {},
    }),
    timeoutMs: 20000,
  },
  {
    name: "codetabs",
    request: (url) => ({
      url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      init: {},
    }),
    timeoutMs: 20000,
  },
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

/** Fetch the page through each proxy in turn and pull the id out of the HTML/JSON. */
async function extractIdViaFetch(rawUrl) {
  for (const proxy of PROXIES) {
    const { url, init } = proxy.request(rawUrl);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), proxy.timeoutMs);
      const resp = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;

      const html = await resp.text();
      for (const pattern of ID_PATTERNS_IN_HTML) {
        const match = html.match(pattern);
        if (match) return { id: match[1], proxy: proxy.name };
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

  const fetched = await extractIdViaFetch(trimmed);
  if (fetched) {
    return {
      id: fetched.id,
      fixedUrl: CANONICAL_BASE + fetched.id,
      method: "fetched",
      via: fetched.proxy,
    };
  }

  throw new Error(
    "Couldn't find an item id — all proxies failed or were blocked. Try opening the link and copying the item id manually."
  );
}
