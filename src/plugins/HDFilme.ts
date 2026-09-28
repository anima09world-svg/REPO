/**
 * HDFilme — SkyStream Plugin
 * Converted from HDFilme.kt (bnyro/GermanProviders)
 * Source: https://hdfilme.my | Language: German | Types: Movie
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const HD_BASE = "https://hdfilme.my";
const HD_CLOUD = "meinecloud.click";
const HD_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const HD_CATEGORIES = [
  { label: "Empfehlungen", path: "" },
  { label: "Neue Filme", path: "?sort=date" },
  { label: "Beliebte Filme", path: "?sort=views" },
  { label: "Action", path: "genre/action" },
  { label: "Komödie", path: "genre/komoedie" },
  { label: "Horror", path: "genre/horror" },
  { label: "Thriller", path: "genre/thriller" },
  { label: "Romantik", path: "genre/romantik" },
  { label: "Animation", path: "genre/animation" },
  { label: "Sci-Fi", path: "genre/science-fiction" },
];

async function hdFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${HD_BASE}/${path}`;
  const res = await http.get(url, { headers: { "User-Agent": HD_UA, "Referer": HD_BASE } });
  return res.text();
}

function hdCard(el: Element): MediaItem | null {
  const link = el.querySelector("a[href*='film'],a[href*='movies'],a.short-poster") as HTMLAnchorElement | null;
  if (!link) return null;
  const img = el.querySelector("img");
  const title = img?.alt || el.querySelector(".title,.short-title,h2")?.textContent?.trim() || "";
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  const yearEl = el.querySelector(".year,.date,.short-year");
  const year = yearEl ? parseInt(yearEl.textContent?.trim() || "0") || undefined : undefined;
  return { title, url: link.href.startsWith("http") ? link.href : `${HD_BASE}${link.href}`, poster, type: "movie", year };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? HD_CATEGORIES.slice(0, 4) : [HD_CATEGORIES.find(c => c.label === category) || HD_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await hdFetch(`${cat.path}${cat.path.includes("?") ? "&" : "?"}page=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll("#dle-content div.item,.movie-card,.short")).map(e => hdCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await hdFetch(`?do=search&subaction=search&story=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll("#dle-content div.item,.movie-card")).map(e => hdCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await hdFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1,.film-title,.short-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".film-poster img,.poster img,.short-poster img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".short-story,.film-description,.synopsis")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genre a,.genres a")).map(a => a.textContent?.trim() || "").filter(Boolean);
  const yearEl = doc.querySelector(".year,.release-year");
  const year = yearEl ? parseInt(yearEl.textContent?.trim() || "") || undefined : undefined;
  return { title, url, poster, description, genres, year, type: "movie" };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await hdFetch(url);
  const streams: StreamLink[] = [];
  // HDFilme uses meinecloud.click and other hosters
  const cloudMatches = html.match(new RegExp(`https?:\\/\\/${HD_CLOUD.replace(".", "\\.")}[^"']+`, "g")) || [];
  for (const u of cloudMatches) streams.push({ url: u, label: "HD Stream", type: "iframe" });
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  const iframes = html.match(/src="(https?:\/\/[^"]+)"/g) || [];
  for (const src of iframes) {
    const u = src.slice(5, -1);
    if (/(streamtape|doodstream|voe\.sx|vidlox)/i.test(u)) streams.push({ url: u, label: "Embed", type: "iframe" });
  }
  return streams;
}

export const manifest = {
  name: "HDFilme", version: "1.0.0", baseUrl: HD_BASE, lang: "de",
  type: ["movie"], categories: HD_CATEGORIES.map(c => c.label),
};
