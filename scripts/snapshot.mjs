// Hourly snapshot of RTV's public news feed, run by GitHub Actions (never by visitors).
// A whole run makes 2 feed requests plus one request per *new* photo, then writes a static copy:
//   _site/data/news.json      list of stories (no bodies)
//   _site/data/a/<id>.json    one story with its cleaned body
//   _site/data/archive.json   14 days of stories with their places, for the News Map time-lapse
//   _site/img/<id>.<ext>      story photos
// Photos, story bodies and the archive persist between runs in img-cache/, so only new stories are fetched.
// If RTV doesn't answer, the run fails and GitHub Pages keeps serving the previous snapshot.
import { mkdir, writeFile, readFile, readdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { WP, decode, stripTags, excerpt, sanitize } from "./_wp.mjs";
import { placesFor } from "./places.mjs";

const BASE = process.env.WP_BASE || WP;           // overridable only for offline testing
const OUT = process.env.OUT_DIR || "_site";
const CACHE = process.env.IMG_CACHE || "img-cache";
const SITE = process.env.SITE_URL || "";            // this site's own address — earlier archive is read from here, never from RTV
const ARCHIVE_DAYS = 14, ARCHIVE_MAX = 600;
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
  await mkdir(join(CACHE, "a"), { recursive: true });

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
    a.places = placesFor(a.title, a.excerpt + " " + text.slice(0, 900), a.categories);
    const tags = (p._embedded?.["wp:term"] || []).flat().filter(t => t.taxonomy === "post_tag").map(t => decode(t.name));
    list.push({ ...a, tags });
    await writeFile(join(CACHE, "a", `${p.id}.json`), JSON.stringify({ ...a, tags, content: body(p.content?.rendered) }));
  }

  // 14-day archive: previous archive (from the cache, else this site's last published copy) + today's stories
  let prev = [];
  try { prev = JSON.parse(await readFile(join(CACHE, "archive.json"), "utf8")); }
  catch { if (SITE) try { const r = await fetch(`${SITE}/data/archive.json`, { signal: AbortSignal.timeout(20000) }); if (r.ok) prev = (await r.json()).articles || []; } catch {} }
  const since = Date.now() - ARCHIVE_DAYS * 864e5, byId = new Map(prev.map(x => [x.id, x]));
  for (const x of list) byId.set(x.id, x);
  const archive = [...byId.values()].filter(x => new Date(x.date) >= since).sort((x, y) => new Date(y.date) - new Date(x.date)).slice(0, ARCHIVE_MAX);
  for (const x of archive) if (x.image) keep.add(x.image.slice(4));
  const keepIds = new Set(archive.map(x => String(x.id)));

  // keep the cache to the archived stories, and publish their photos and bodies
  for (const f of await readdir(CACHE)) {
    if (f === "a" || f === "archive.json") continue;
    if (!keep.has(f)) await rm(join(CACHE, f));
    else await copyFile(join(CACHE, f), join(OUT, "img", f));
  }
  for (const f of await readdir(join(CACHE, "a"))) {
    if (!keepIds.has(f.replace(".json", ""))) await rm(join(CACHE, "a", f));
    else await copyFile(join(CACHE, "a", f), join(OUT, "data/a", f));
  }
  await writeFile(join(CACHE, "archive.json"), JSON.stringify(archive));
  await writeFile(join(OUT, "data/archive.json"), JSON.stringify({ updated: new Date().toISOString(), days: ARCHIVE_DAYS, articles: archive }));
  await writeFile(join(OUT, "data/news.json"), JSON.stringify({ updated: new Date().toISOString(), source: "english.rtvlive.com (public feed)", articles: list }));
  console.log(`snapshot: ${list.length} stories (${archive.length} in the ${ARCHIVE_DAYS}-day archive), ${fetched} new photos, ${2 + fetched} requests to the feed`);
}

main().catch(e => { console.error("snapshot failed — keeping the previous site live:", e.message); process.exit(1); });
