// Shared helpers for reading RTV's public WordPress feed (read-only).
export const WP = "https://english.rtvlive.com/wp-json/wp/v2";
// RTV's server sometimes accepts a connection and never answers; give up instead of hanging.
export const wpFetch = url => fetch(url, { signal: AbortSignal.timeout(10000) });

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", rupee: "₹" };

export function decode(s = "") {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export const stripTags = (s = "") => decode(String(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

export function excerpt(html) {
  return stripTags(html).replace(/\s*\[…\]\s*$/, "…").replace(/\s*\[\.\.\.\]\s*$/, "…");
}

let catCache = null, catAt = 0;
export async function categories() {
  if (catCache && Date.now() - catAt < 3600e3) return catCache;
  const r = await wpFetch(`${WP}/categories?per_page=100&_fields=id,name,count`);
  if (!r.ok) throw new Error("categories " + r.status);
  const list = await r.json();
  catCache = { byId: new Map(list.map(c => [c.id, decode(c.name)])), byName: new Map(list.map(c => [decode(c.name).toLowerCase(), c.id])) };
  catAt = Date.now();
  return catCache;
}

export function image(post, size = "medium_large") {
  const m = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!m || !m.source_url) return null;
  const s = m.media_details?.sizes || {};
  return (s[size] || s.large || s.medium_large || s.medium || {}).source_url || m.source_url;
}

export function toArticle(post, cats) {
  const names = (post.categories || []).map(id => cats.byId.get(id)).filter(n => n && n !== "Uncategorized");
  const primary = names.find(n => n !== "Trending") || names[0] || "News";
  const words = stripTags(post.content?.rendered || "").split(" ").length;
  return {
    id: post.id,
    date: post.date_gmt ? post.date_gmt + "Z" : post.date,
    link: post.link,
    title: decode(post.title?.rendered || "Untitled"),
    excerpt: excerpt(post.excerpt?.rendered || ""),
    category: primary,
    categories: names.length ? names : ["News"],
    image: image(post),
    imageLarge: image(post, "large"),
    readMins: Math.max(1, Math.round(words / 220)),
  };
}

export function json(body, status = 200, cacheSeconds = 60) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${cacheSeconds}`,
      "netlify-cdn-cache-control": `public, s-maxage=${cacheSeconds * 2}, stale-while-revalidate=600`,
    },
  });
}

// Allow-list sanitiser for article bodies: keeps text structure, links, images and YouTube embeds only.
const KEEP = new Set(["p", "br", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "b", "em", "i", "a", "img", "figure", "figcaption", "iframe"]);
export function sanitize(html = "") {
  return String(html)
    .replace(/<(script|style|noscript|form|object|embed|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (tag, name, attrs) => {
      name = name.toLowerCase();
      if (!KEEP.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      const attr = k => (attrs.match(new RegExp(`\\s${k}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i")) || [])[2] || "";
      const safeUrl = u => /^https:\/\//i.test(u) ? u.replace(/"/g, "%22") : "";
      if (name === "a") {
        const href = safeUrl(attr("href"));
        return href ? `<a href="${href}" target="_blank" rel="noopener">` : "<a>";
      }
      if (name === "img") {
        const src = safeUrl(attr("src"));
        return src ? `<img src="${src}" alt="${attr("alt").replace(/"/g, "&quot;")}" loading="lazy">` : "";
      }
      if (name === "iframe") {
        const src = safeUrl(attr("src"));
        return /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//i.test(src)
          ? `<iframe src="${src}" loading="lazy" allowfullscreen title="Video">` : "<iframe hidden>";
      }
      return `<${name}>`;
    })
    .replace(/<p>\s*(&nbsp;)?\s*<\/p>/g, "");
}
