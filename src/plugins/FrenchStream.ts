/**
 * FrenchStream — SkyStream Plugin
 * Converted from FrenchStreamProvider.kt (cloudstream-frenchstream)
 * Source: https://french-stream.one | Language: French | Types: Movie, TvSeries
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[]; streams?: StreamLink[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const FS_BASE = "https://french-stream.one";
const FS_MIRRORS = ["https://french-stream.one", "https://french-stream.pink", "https://fstream.info"];
const FS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const FS_CATEGORIES = [
  { label: "Films récents", path: "?order=date" },
  { label: "Séries récentes", path: "xfsearch/series/?order=date" },
  { label: "Netflix", path: "xfsearch/netflix/" },
  { label: "Amazon Prime", path: "xfsearch/amazon-prime/" },
  { label: "Action", path: "xfsearch/action/" },
  { label: "Comédie", path: "xfsearch/comedie/" },
  { label: "Horreur", path: "xfsearch/horreur/" },
  { label: "Animation", path: "xfsearch/animation/" },
];

async function fsFetch(url: string): Promise<string> {
  for (const mirror of FS_MIRRORS) {
    try {
      const target = url.startsWith("http") ? url : `${mirror}/${url}`;
      const res = await http.get(target, { headers: { "User-Agent": FS_UA } });
      return await res.text();
    } catch { /* try next mirror */ }
  }
  throw new Error("All FrenchStream mirrors failed");
}

function fsCard(el: Element): MediaItem | null {
  const link = el.querySelector("a.short-poster,a.clearfix") as HTMLAnchorElement | null;
  if (!link) return null;
  const url = link.href;
  const img = el.querySelector("img");
  const title = img?.alt || el.querySelector(".short-title,h2")?.textContent?.trim() || "";
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  const yearEl = el.querySelector(".short-year,span.year");
  const year = yearEl ? parseInt(yearEl.textContent?.trim() || "0") || undefined : undefined;
  return { title, url, poster, type: url.includes("/series/") ? "tvseries" : "movie", year };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? FS_CATEGORIES : [FS_CATEGORIES.find(c => c.label === category) || FS_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await fsFetch(`${FS_BASE}/${cat.path}&paged=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll("#dle-content .short,.movie-item"))
        .map(e => fsCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await fsFetch(`${FS_BASE}/?do=search&subaction=search&story=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll("#dle-content .short,.movie-item")).map(e => fsCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await fsFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1.short-title,h1")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".short-poster img,.poster img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".short-story,.description,#description")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".short-story a[href*='xfsearch/'],.genre a")).map(a => a.textContent?.trim() || "").filter(Boolean);
  const yearText = doc.querySelector(".short-year,.year-info")?.textContent?.trim();
  const year = yearText ? parseInt(yearText) || undefined : undefined;
  const episodeEls = Array.from(doc.querySelectorAll(".tldr-eps a,.episode-link,.eps a"));
  const episodes: Episode[] = episodeEls.map((a, i) => {
    const eu = (a as HTMLAnchorElement).href || "";
    const sm = eu.match(/saison[- _]?(\d+)/i) || a.textContent?.match(/S(\d+)/i);
    const em = eu.match(/episode[- _]?(\d+)/i) || a.textContent?.match(/E(\d+)/i);
    return { title: a.textContent?.trim() || `Épisode ${i + 1}`, url: eu, season: sm ? parseInt(sm[1]) : 1, episode: em ? parseInt(em[1]) : i + 1 };
  });
  return { title, url, poster, description, genres, year, episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await fsFetch(url);
  const streams: StreamLink[] = [];
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  const iframes = html.match(/src="(https?:\/\/[^"]+)"/g) || [];
  for (const src of iframes) {
    const u = src.slice(5, -1);
    if (/(vidbom|upvid|vido|dood|streamtape|sibnet)/i.test(u)) streams.push({ url: u, label: "Embed", type: "iframe" });
  }
  return streams;
}

export const manifest = {
  name: "French-Stream", version: "1.0.0", baseUrl: FS_BASE, lang: "fr",
  type: ["movie", "tvseries"], categories: FS_CATEGORIES.map(c => c.label),
};
