/**
 * Kinoger — SkyStream Plugin
 * Converted from Kinoger.kt (bnyro/GermanProviders)
 * Source: https://kinoger.com | Language: German | Types: Movie, TvSeries
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const KG_BASE = "https://kinoger.com";
const KG_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const KG_CATEGORIES = [
  { label: "Alle Filme", path: "" },
  { label: "Action", path: "stream/action" },
  { label: "Fantasy", path: "stream/fantasy" },
  { label: "Drama", path: "stream/drama" },
  { label: "Mystery", path: "stream/mystery" },
  { label: "Romance", path: "stream/romance" },
  { label: "Animation", path: "stream/animation" },
  { label: "Horror", path: "stream/horror" },
  { label: "Familie", path: "stream/familie" },
  { label: "Komödie", path: "stream/komdie" },
];

async function kgFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${KG_BASE}/${path}`;
  const res = await http.get(url, { headers: { "User-Agent": KG_UA, "Referer": KG_BASE } });
  return res.text();
}

function kgCard(el: Element): MediaItem | null {
  const link = el.querySelector("a[href]") as HTMLAnchorElement | null;
  if (!link) return null;
  const img = el.querySelector("img");
  const title = img?.alt || el.querySelector(".short-title,.title,h3")?.textContent?.trim() || link.title || "";
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  const href = link.href.startsWith("http") ? link.href : `${KG_BASE}/${link.href}`;
  return { title, url: href, poster, type: href.includes("/serie/") ? "tvseries" : "movie" };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? KG_CATEGORIES.slice(0, 4) : [KG_CATEGORIES.find(c => c.label === category) || KG_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await kgFetch(`${cat.path}/page/${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll("div#dle-content div.short,.movie-item")).map(e => kgCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await kgFetch(`?do=search&subaction=search&story=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll("div#dle-content div.short,.movie-item")).map(e => kgCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await kgFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1,.short-title,.film-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".short-poster img,.poster img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".short-story,.description,.synopsis")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genre a,.genres a")).map(a => a.textContent?.trim() || "").filter(Boolean);
  const yearEl = doc.querySelector(".year,.release-year,.short-year");
  const year = yearEl ? parseInt(yearEl.textContent?.trim() || "") || undefined : undefined;

  const episodeLinks = Array.from(doc.querySelectorAll(".eps a,.episode-link,.tldr-eps a"));
  const episodes: Episode[] = episodeLinks.map((a, i) => {
    const eu = (a as HTMLAnchorElement).href;
    const sm = eu.match(/staffel-(\d+)/i) || eu.match(/season[- ]?(\d+)/i);
    const em = eu.match(/episode[- ]?(\d+)/i);
    return { title: a.textContent?.trim() || `Episode ${i + 1}`, url: eu.startsWith("http") ? eu : `${KG_BASE}${eu}`, season: sm ? parseInt(sm[1]) : 1, episode: em ? parseInt(em[1]) : i + 1 };
  });
  return { title, url, poster, description, genres, year, type: url.includes("/serie/") ? "tvseries" : "movie", episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await kgFetch(url);
  const streams: StreamLink[] = [];
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  const iframes = html.match(/src="(https?:\/\/[^"]+)"/g) || [];
  for (const src of iframes) {
    const u = src.slice(5, -1);
    if (/(streamtape|doodstream|voe|upstream|vidlox|filemoon)/i.test(u)) streams.push({ url: u, label: "Embed", type: "iframe" });
  }
  return streams;
}

export const manifest = {
  name: "Kinoger", version: "1.0.0", baseUrl: KG_BASE, lang: "de",
  type: ["movie", "tvseries"], categories: KG_CATEGORIES.map(c => c.label),
};
