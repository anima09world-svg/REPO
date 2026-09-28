/**
 * Serienstream — SkyStream Plugin
 * Converted from Serienstream.kt (bnyro/GermanProviders)
 * Source: https://serienstream.to | Language: German | Types: TvSeries
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const SS_BASE = "https://serienstream.to";
const SS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const SS_CATEGORIES = [
  { label: "Serien A-Z", path: "serien" },
  { label: "Neue Serien", path: "serien?order=date" },
  { label: "Beliebte Serien", path: "serien?order=views" },
  { label: "Action", path: "serien?genre=action" },
  { label: "Komödie", path: "serien?genre=komoedie" },
  { label: "Drama", path: "serien?genre=drama" },
  { label: "Krimi", path: "serien?genre=krimi" },
  { label: "Thriller", path: "serien?genre=thriller" },
  { label: "Sci-Fi", path: "serien?genre=science-fiction" },
  { label: "Fantasy", path: "serien?genre=fantasy" },
  { label: "Anime", path: "serien?genre=anime" },
];

async function ssFetch(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${SS_BASE}/${path}`;
  const res = await http.get(url, { headers: { "User-Agent": SS_UA, "Referer": SS_BASE } });
  return res.text();
}

function ssCard(el: Element): MediaItem | null {
  const link = el.querySelector("a[href*='/serie/'],.coverListItem > a") as HTMLAnchorElement | null;
  if (!link) return null;
  const img = el.querySelector("img");
  const title = img?.alt || el.querySelector("h3,.title")?.textContent?.trim() || "";
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  return { title, url: link.href.startsWith("http") ? link.href : `${SS_BASE}${link.href}`, poster, type: "tvseries" };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? SS_CATEGORIES.slice(0, 5) : [SS_CATEGORIES.find(c => c.label === category) || SS_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await ssFetch(`${cat.path}&page=${page}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll(".seriesListContainer > ul > li,.coverList > li")).map(e => ssCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await ssFetch(`suche/?q=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll(".seriesListContainer > ul > li,.coverList > li")).map(e => ssCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await ssFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1.seriesTitle,.page-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".seriesCoverBox img,.cover img,.poster img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".seri_des p,.synopsis,.series-description")?.textContent?.trim();
  const genres = Array.from(doc.querySelectorAll(".genres a,.genre-tag")).map(a => a.textContent?.trim() || "").filter(Boolean);

  // Build episode list from season tabs
  const episodes: Episode[] = [];
  const seasonNodes = Array.from(doc.querySelectorAll("#stream .seasonEpisodesList li a,.episodeList a"));
  for (const a of seasonNodes) {
    const eu = (a as HTMLAnchorElement).href;
    const fullUrl = eu.startsWith("http") ? eu : `${SS_BASE}${eu}`;
    const sm = fullUrl.match(/staffel-(\d+)/i);
    const em = fullUrl.match(/episode-(\d+)/i);
    const epNum = em ? parseInt(em[1]) : 0;
    const seNum = sm ? parseInt(sm[1]) : 1;
    episodes.push({ title: a.textContent?.trim() || `S${seNum}E${epNum}`, url: fullUrl, season: seNum, episode: epNum });
  }
  return { title, url, poster, description, genres, type: "tvseries", episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await ssFetch(url);
  const streams: StreamLink[] = [];
  // Hoster redirect links
  const redirects = html.match(/href="([^"]*(?:redirect|hosters)[^"]+)"/gi) || [];
  for (const m of redirects) {
    const u = m.match(/href="([^"]+)"/)?.[1];
    if (u) streams.push({ url: u.startsWith("http") ? u : `${SS_BASE}${u}`, label: "Hoster", type: "iframe" });
  }
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "HLS", type: "hls" });
  if (!streams.length) streams.push({ url, label: "Serienstream Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "Serienstream", version: "1.0.0", baseUrl: SS_BASE, lang: "de",
  type: ["tvseries"], categories: SS_CATEGORIES.map(c => c.label),
};
