/**
 * FrenchManga — SkyStream Plugin
 * Converted from FrenchMangaProvider.kt (cloudstream-frenchstream)
 * Source: https://w16.french-manga.net | Language: French | Types: Anime
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const FM_BASE = "https://w16.french-manga.net";
const FM_MIRRORS = ["https://w16.french-manga.net", "https://french-manga.net"];
const FM_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const FM_CATEGORIES = [
  { label: "Derniers ajouts", path: "?" },
  { label: "Action", path: "?genre=action" },
  { label: "Aventure", path: "?genre=aventure" },
  { label: "Comédie", path: "?genre=comedie" },
  { label: "Drame", path: "?genre=drame" },
  { label: "Fantasy", path: "?genre=fantasy" },
  { label: "Romance", path: "?genre=romance" },
  { label: "Shonen", path: "?genre=shonen" },
  { label: "Seinen", path: "?genre=seinen" },
];

async function fmFetch(path: string): Promise<string> {
  for (const mirror of FM_MIRRORS) {
    try {
      const url = path.startsWith("http") ? path : `${mirror}/${path}`;
      const res = await http.get(url, { headers: { "User-Agent": FM_UA, "Referer": FM_BASE } });
      return await res.text();
    } catch { /* next */ }
  }
  throw new Error("FrenchManga: all mirrors failed");
}

function fmCard(el: Element): MediaItem | null {
  const link = el.querySelector("a") as HTMLAnchorElement | null;
  if (!link) return null;
  const title = el.querySelector(".entry-title,.series-title")?.textContent?.trim() || link.title || "";
  const img = el.querySelector("img");
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  return { title, url: link.href, poster, type: "anime" };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? FM_CATEGORIES : [FM_CATEGORIES.find(c => c.label === category) || FM_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await fmFetch(`${FM_BASE}/${cat.path}&page=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll(".page-item-detail,.series-item,.manga-item"))
        .map(e => fmCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await fmFetch(`${FM_BASE}/?s=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll(".page-item-detail,.series-item,.c-tabs-item__content"))
    .map(e => fmCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await fmFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1,.post-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".summary_image img,.cover img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".summary__content,.synopsis")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genres-content a,.genre a")).map(a => a.textContent?.trim() || "").filter(Boolean);

  // Episodes = chapters in manga context
  const epLinks = Array.from(doc.querySelectorAll(".wp-manga-chapter a, .chapter-link"));
  const episodes: Episode[] = epLinks.map((a, i) => {
    const eu = (a as HTMLAnchorElement).href || "";
    const numMatch = a.textContent?.match(/[\d.]+/);
    return {
      title: a.textContent?.trim() || `Chapitre ${i + 1}`,
      url: eu,
      season: 1,
      episode: numMatch ? parseFloat(numMatch[0]) : i + 1,
    };
  }).reverse(); // oldest first
  return { title, url, poster, description, genres, episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await fmFetch(url);
  const streams: StreamLink[] = [];
  // Manga: look for image list (pages) or video server
  const imgMatches = html.match(/"url":"(https?:[^"]+\.(jpg|png|webp))"/g) || [];
  for (const m of imgMatches) {
    const u = m.replace(/"url":"/, "").replace(/"$/, "").replace(/\\\//g, "/");
    streams.push({ url: u, label: "Page", type: "img" });
  }
  const vidMatches = html.match(/src="(https?:\/\/[^"]+)"/g) || [];
  for (const src of vidMatches) {
    const u = src.slice(5, -1);
    if (/(youtu|dailymotion|vidbom|streamtape)/i.test(u)) streams.push({ url: u, label: "Video", type: "iframe" });
  }
  return streams;
}

export const manifest = {
  name: "French-Manga", version: "1.0.0", baseUrl: FM_BASE, lang: "fr",
  type: ["anime"], categories: FM_CATEGORIES.map(c => c.label),
};
