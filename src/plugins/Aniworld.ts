/**
 * Aniworld — SkyStream Plugin
 * Converted from Aniworld.kt (bnyro/GermanProviders)
 * Source: https://aniworld.to | Language: German | Types: Anime
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const AW_BASE = "https://aniworld.to";
const AW_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const AW_CATEGORIES = [
  { label: "Neu hinzugefügt", path: "neu" },
  { label: "Beliebte Anime", path: "beliebte-animes" },
  { label: "Action", path: "genre/action" },
  { label: "Abenteuer", path: "genre/abenteuer" },
  { label: "Komödie", path: "genre/komoedie" },
  { label: "Drama", path: "genre/drama" },
  { label: "Fantasy", path: "genre/fantasy" },
  { label: "Horror", path: "genre/horror" },
  { label: "Romance", path: "genre/romance" },
  { label: "Sci-Fi", path: "genre/science-fiction" },
  { label: "Isekai", path: "genre/isekai" },
];

async function awFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${AW_BASE}/${path}`;
  const res = await http.get(url, { headers: { "User-Agent": AW_UA, "Referer": AW_BASE } });
  return res.text();
}

function awCard(el: Element): MediaItem | null {
  const link = el.querySelector("a") as HTMLAnchorElement | null;
  if (!link) return null;
  const title = el.querySelector("h3,.title,.series-title")?.textContent?.trim() || link.title || "";
  const img = el.querySelector("img");
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  const type = link.href.includes("animemovies") ? "animemovie" : "anime";
  return { title, url: link.href, poster, type };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? AW_CATEGORIES : [AW_CATEGORIES.find(c => c.label === category) || AW_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await awFetch(`${cat.path}?page=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll(".seriesListContainer li,.anime-card,.series-item"))
        .map(e => awCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await awFetch(`suche/?q=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll(".seriesListContainer li,.anime-card,.series-item"))
    .map(e => awCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await awFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1.seriesTitle,.page-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".seriesCoverBox img,.cover img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".seri_des p,.synopsis,.series-description")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genres a,.genre-tag")).map(a => a.textContent?.trim() || "").filter(Boolean);

  // Season/episode navigation
  const episodes: Episode[] = [];
  const seasonLinks = Array.from(doc.querySelectorAll("#stream .episodeList a,.episode-item a"));
  for (const a of seasonLinks) {
    const eu = (a as HTMLAnchorElement).href || "";
    const sm = eu.match(/staffel-(\d+)/i);
    const em = eu.match(/episode-(\d+)/i);
    episodes.push({
      title: a.textContent?.trim() || `S${sm?.[1] || 1}E${em?.[1] || "?"}`,
      url: eu, season: sm ? parseInt(sm[1]) : 1, episode: em ? parseInt(em[1]) : 0,
    });
  }
  return { title, url, poster, description, genres, episodes: episodes.length ? episodes : undefined, type: "anime" };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await awFetch(url);
  const streams: StreamLink[] = [];
  // Aniworld uses VOE / Streamtape / Vidoza as hosters
  const hosters = html.match(/href="([^"]+)"[^>]*>\s*(?:VOE|Streamtape|Vidoza|Doodstream)/gi) || [];
  for (const m of hosters) {
    const u = m.match(/href="([^"]+)"/)?.[1];
    if (u) streams.push({ url: u, label: "Hoster", type: "iframe" });
  }
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  return streams;
}

export const manifest = {
  name: "Aniworld", version: "1.0.0", baseUrl: AW_BASE, lang: "de",
  type: ["anime"], categories: AW_CATEGORIES.map(c => c.label),
};
