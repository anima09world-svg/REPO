/**
 * Movix — SkyStream Plugin
 * Converted from MovixProvider.kt (cloudstream-frenchstream)
 * Source: https://movix.date | Language: French | Types: Movie, TvSeries
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number; score?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const MX_BASE = "https://movix.date";
const MX_MIRRORS = ["https://movix.date", "https://movix.show", "https://movix.cash"];
const MX_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const MX_CATEGORIES = [
  { label: "Films récents", path: "movies?sort=date" },
  { label: "Films populaires", path: "movies?sort=views" },
  { label: "Séries récentes", path: "series?sort=date" },
  { label: "Séries populaires", path: "series?sort=views" },
  { label: "Action", path: "movies?genre=action" },
  { label: "Comédie", path: "movies?genre=comedie" },
  { label: "Horreur", path: "movies?genre=horreur" },
  { label: "Animation", path: "movies?genre=animation" },
];

async function mxFetch(path: string): Promise<string> {
  for (const mirror of MX_MIRRORS) {
    try {
      const url = path.startsWith("http") ? path : `${mirror}/${path}`;
      const res = await http.get(url, { headers: { "User-Agent": MX_UA } });
      return await res.text();
    } catch { /* next */ }
  }
  throw new Error("Movix: all mirrors failed");
}

function mxCard(el: Element): MediaItem | null {
  const link = el.querySelector("a") as HTMLAnchorElement | null;
  if (!link) return null;
  const title = el.querySelector(".title,.movie-title,h3")?.textContent?.trim() || link.title || "";
  const img = el.querySelector("img");
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  const year = parseInt(el.querySelector(".year,.date")?.textContent?.trim() || "0") || undefined;
  const score = parseFloat(el.querySelector(".score,.rating,.note")?.textContent?.trim() || "0") || undefined;
  const isSeries = link.href.includes("/series/") || el.className.includes("series");
  return { title, url: link.href, poster, type: isSeries ? "tvseries" : "movie", year, score };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? MX_CATEGORIES : [MX_CATEGORIES.find(c => c.label === category) || MX_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await mxFetch(`${MX_BASE}/${cat.path}&page=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll(".movie-card,.item,.media-item"))
        .map(e => mxCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await mxFetch(`${MX_BASE}/search?q=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll(".movie-card,.item,.media-item")).map(e => mxCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await mxFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1,.title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".poster img,.cover img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".synopsis,.description,.overview")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genres a,.genre a")).map(a => a.textContent?.trim() || "").filter(Boolean);
  const yearEl = doc.querySelector(".year,.release-year");
  const year = yearEl ? parseInt(yearEl.textContent?.trim() || "") || undefined : undefined;

  // Episodes for series
  const epLinks = Array.from(doc.querySelectorAll(".episode-link,.ep-item a,.episode a"));
  const episodes: Episode[] = epLinks.map((a, i) => {
    const eu = (a as HTMLAnchorElement).href || "";
    const sm = eu.match(/saison[- _]?(\d+)/i) || a.textContent?.match(/S(\d+)/i);
    const em = eu.match(/episode[- _]?(\d+)/i) || a.textContent?.match(/[ÉE](\d+)/i);
    return { title: a.textContent?.trim() || `Épisode ${i + 1}`, url: eu, season: sm ? parseInt(sm[1]) : 1, episode: em ? parseInt(em[1]) : i + 1 };
  });
  return { title, url, poster, description, genres, year, episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await mxFetch(url);
  const streams: StreamLink[] = [];
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  const embedPat = /(vidbom|upvid|vido|doodstream|streamtape|sibnet|sendvid)/i;
  const iframes = html.match(/src="(https?:\/\/[^"]+)"/g) || [];
  for (const src of iframes) {
    const u = src.slice(5, -1);
    if (embedPat.test(u)) streams.push({ url: u, label: "Embed", type: "iframe" });
  }
  return streams;
}

export const manifest = {
  name: "Movix", version: "1.0.0", baseUrl: MX_BASE, lang: "fr",
  type: ["movie", "tvseries"], categories: MX_CATEGORIES.map(c => c.label),
};
