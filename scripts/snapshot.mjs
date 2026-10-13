// Hourly snapshot of RTV's public news feed, run by GitHub Actions (never by visitors).
// A whole run makes 2 feed requests plus one request per *new* photo, then writes a static copy:
//   _site/data/news.json      list of stories (no bodies)
//   _site/data/a/<id>.json    one story with its cleaned body
//   _site/img/<id>.<ext>      story photos (kept between runs in img-cache/, so only new ones are fetched)
// If RTV doesn't answer, the run fails and GitHub Pages keeps serving the previous snapshot.
import { mkdir, writeFile, readdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { WP, decode, stripTags, excerpt, sanitize } from "./_wp.mjs";

const BASE = process.env.WP_BASE || WP;           // overridable only for offline testing
const OUT = process.env.OUT_DIR || "_site";
const CACHE = process.env.IMG_CACHE || "img-cache";
const COUNT = 60;                                  // stories kept in the snapshot
const UA = "rtv-live-demo-snapshot/1.0 (+https://github.com/mangipudiyash/rtv-live-demo; hourly, read-only)";
const pause = ms => new Promise(r => setTimeout(r, ms));

async function get(url, as = "json") {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: as === "json" ? "application/json" : "image/*" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} for ${url}`);
  return as === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
}

function photoUrl(post) {
  const m = post._embedded?.["wp:featuredmedia"]?.[0];
  if (!m?.source_url) return null;
  const s = m.media_details?.sizes || {};
  return (s.medium_large || s.large || s.medium || {}).source_url || m.source_url;
}

// Article bodies keep their text, links and YouTube embeds; inline photos are dropped so visitors never load from RTV.
const body = html => sanitize(html).replace(/<img[^>]*>/g, "").replace(/<figure>\s*(<figcaption>[\s\S]*?<\/figcaption>)?\s*<\/figure>/g, "").replace(/<p>\s*<\/p>/g, "");

async function main() {
  const cats = await get(`${BASE}/categories?per_page=100&_fields=id,name`);
  const catName = new Map(cats.map(c => [c.id, decode(c.name)]));
  await pause(1000);
  const posts = await get(`${BASE}/posts?per_page=${COUNT}&_embed=wp:featuredmedia,wp:term&_fields=id,date_gmt,link,title,excerpt,content,categories,_links,_embedded`);
  if (!Array.isArray(posts) || !posts.length) throw new Error("feed returned no stories");

  await mkdir(join(OUT, "data/a"), { recursive: true });
  await mkdir(join(OUT, "img"), { recursive: true });
  await mkdir(CACHE, { recursive: true });

  const list = [], keep = new Set();
  let fetched = 0;
  for (const p of posts) {
    const names = (p.categories || []).map(id => catName.get(id)).filter(n => n && n !== "Uncategorized");
    const text = stripTags(p.content?.rendered || "");
    let image = null;
    const src = photoUrl(p);
    if (src && (/^https:\/\//.test(src) || process.env.WP_BASE)) {   // WP_BASE = offline test stand-in
      const ext = (extname(new URL(src).pathname).toLowerCase().match(/^\.(jpe?g|png|webp|gif)$/) || [".jpg"])[0];
      const file = `${p.id}${ext}`;
      keep.add(file);
      try {
        if (!existsSync(join(CACHE, file))) { await writeFile(join(CACHE, file), await get(src, "bin")); fetched++; await pause(800); }
        image = `img/${file}`;
      } catch (e) { console.warn("photo skipped:", p.id, e.message); }
    }
    const a = {
      id: p.id,
      date: p.date_gmt + "Z",
      link: p.link,
      title: decode(p.title?.rendered || "Untitled"),
      excerpt: excerpt(p.excerpt?.rendered || ""),
      category: names.find(n => n !== "Trending") || names[0] || "News",
      categories: names.length ? names : ["News"],
      image, imageLarge: image,
      readMins: Math.max(1, Math.round(text.split(" ").length / 220)),
    };
    const tags = (p._embedded?.["wp:term"] || []).flat().filter(t => t.taxonomy === "post_tag").map(t => decode(t.name));
    list.push({ ...a, tags });
    await writeFile(join(OUT, "data/a", `${p.id}.json`), JSON.stringify({ ...a, tags, content: body(p.content?.rendered) }));
  }

  // keep the photo cache to the current stories, and publish those photos
  for (const f of await readdir(CACHE)) {
    if (!keep.has(f)) await rm(join(CACHE, f));
    else await copyFile(join(CACHE, f), join(OUT, "img", f));
  }
  await writeFile(join(OUT, "data/news.json"), JSON.stringify({ updated: new Date().toISOString(), source: "english.rtvlive.com (public feed)", articles: list }));
  console.log(`snapshot: ${list.length} stories, ${fetched} new photos, ${2 + fetched} requests to the feed`);
}

main().catch(e => { console.error("snapshot failed — keeping the previous site live:", e.message); process.exit(1); });
