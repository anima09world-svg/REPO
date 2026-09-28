/**
 * ARD Mediathek — SkyStream Plugin
 * Converted from ARD.kt (bnyro/GermanProviders)
 * Source: ARD Mediathek API | Language: German | Types: Movie, TvSeries, Live
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const ARD_BASE = "https://www.ardmediathek.de";
const ARD_API = "https://api.ardmediathek.de/page-gateway/pages/ard";
const ARD_VIDEO_API = "https://api.ardmediathek.de/media-item";
const ARD_CATEGORIES = [
  { label: "Startseite", path: "?embedded=true" },
  { label: "Dokumentation", path: "/compilation/dokumentation?embedded=true" },
  { label: "Serien & Filme", path: "/compilation/serien-und-filme?embedded=true" },
  { label: "Unterhaltung", path: "/compilation/unterhaltung?embedded=true" },
  { label: "Wissen", path: "/compilation/wissen?embedded=true" },
  { label: "Kultur", path: "/compilation/kultur?embedded=true" },
  { label: "Sport", path: "/compilation/sport?embedded=true" },
  { label: "Kinder", path: "/compilation/kinder?embedded=true" },
  { label: "Nachrichten", path: "/compilation/nachrichten?embedded=true" },
];

interface ArdWidget { id: string; title?: string; shows?: ArdShow[]; teasers?: ArdTeaser[] }
interface ArdShow { id: string; title?: string; href?: string; images?: { aspect16x9?: { src?: string } } }
interface ArdTeaser { id: string; title?: string; href?: string; duration?: number; publicationStartDate?: string;
  images?: { aspect16x9?: { src?: string } }; synopsis?: string }
interface ArdPage { widgets?: ArdWidget[] }

function ardTeaserToItem(t: ArdTeaser): MediaItem {
  return {
    title: t.title || t.id,
    url: `${ARD_BASE}${t.href || "/video/" + t.id}`,
    poster: t.images?.aspect16x9?.src?.replace("{width}", "640") || undefined,
    type: "movie",
  };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? ARD_CATEGORIES.slice(0, 4) : [ARD_CATEGORIES.find(c => c.label === category) || ARD_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const url = `${ARD_API}${cat.path}&pageNumber=${page - 1}`;
      const data = await (await http.get(url)).json<ArdPage>();
      for (const w of (data?.widgets || []).slice(0, 3)) {
        const items = (w.teasers || []).map(ardTeaserToItem).filter(i => i.title);
        if (items.length) sections.push({ title: w.title || cat.label, items: items.slice(0, 15) });
      }
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const url = `https://api.ardmediathek.de/search-gateway/search?query=${encodeURIComponent(query)}&limit=30`;
  const data = await (await http.get(url)).json<{ items?: ArdTeaser[] }>();
  return (data?.items || []).map(ardTeaserToItem);
}

export async function load(url: string): Promise<MediaDetail> {
  const idMatch = url.match(/\/(?:video|sendung)\/([A-Z0-9_-]+)/i);
  const id = idMatch?.[1] || url.split("/").pop() || "";
  const data = await (await http.get(`${ARD_VIDEO_API}/${id}?mcV6=true`)).json<ArdTeaser & { synopsis?: string; episodes?: ArdTeaser[] }>();
  const episodes: Episode[] = (data?.episodes || []).map((e, i) => ({
    title: e.title || `Episode ${i + 1}`,
    url: `${ARD_BASE}${e.href || "/video/" + e.id}`,
    season: 1, episode: i + 1,
  }));
  return {
    title: data?.title || id,
    url,
    poster: data?.images?.aspect16x9?.src?.replace("{width}", "640") || undefined,
    description: data?.synopsis,
    episodes: episodes.length ? episodes : undefined,
    type: "movie",
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const idMatch = url.match(/\/(?:video|sendung)\/([A-Z0-9_-]+)/i);
  const id = idMatch?.[1] || url.split("/").pop() || "";
  const streams: StreamLink[] = [];
  try {
    const data = await (await http.get(`${ARD_VIDEO_API}/${id}?mcV6=true`)).json<{ streams?: Array<{ url?: string; kind?: string; mimeType?: string }> }>();
    for (const s of (data?.streams || [])) {
      if (!s.url) continue;
      const type = s.mimeType?.includes("m3u8") ? "hls" : s.mimeType?.includes("mp4") ? "video" : "video";
      streams.push({ url: s.url, label: s.kind || "Stream", type });
    }
  } catch { /* fallback */ }
  if (!streams.length) streams.push({ url, label: "ARD Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "ARD Mediathek", version: "1.0.0", baseUrl: ARD_BASE, lang: "de",
  type: ["movie", "tvseries", "live"], categories: ARD_CATEGORIES.map(c => c.label),
};
