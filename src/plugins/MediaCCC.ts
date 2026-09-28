/**
 * MediaCCC (C3TV) — SkyStream Plugin
 * Converted from MediaCCC.kt (bnyro/GermanProviders)
 * Source: https://media.ccc.de | Language: German/International | Types: Video
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[] }
interface StreamLink { url: string; label?: string; type?: string }

const CCC_BASE = "https://media.ccc.de";
const CCC_API = "https://api.media.ccc.de/public";
const CCC_CATEGORIES = [
  { label: "Recent Events", path: "events/recent" },
  { label: "Popular Events", path: "events/popular" },
  { label: "Conferences", path: "conferences" },
];

interface CccEvent { guid: string; title: string; thumbUrl?: string; posterUrl?: string; description?: string; releaseDate?: string; frontendLink: string; tags?: string[] }
interface CccConference { acronym: string; title: string; logoPng?: string; url: string }
interface CccEventsResp { events?: CccEvent[] }
interface CccConfsResp { conferences?: CccConference[] }

function cccEventToItem(e: CccEvent): MediaItem {
  const year = e.releaseDate ? new Date(e.releaseDate).getFullYear() : undefined;
  return { title: e.title, url: e.frontendLink || `${CCC_BASE}/v/${e.guid}`, poster: e.thumbUrl || e.posterUrl, type: "video", year };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  if (category === "all" || category === "Recent Events") {
    try {
      const data = await (await http.get(`${CCC_API}/events/recent`)).json<CccEventsResp>();
      const items = (data?.events || []).slice((page - 1) * 20, page * 20).map(cccEventToItem);
      if (items.length) sections.push({ title: "Recent Events", items });
    } catch { /* skip */ }
  }
  if (category === "all" || category === "Conferences") {
    try {
      const data = await (await http.get(`${CCC_API}/conferences`)).json<CccConfsResp>();
      const items = (data?.conferences || []).slice(0, 20).map(c => ({
        title: c.title, url: c.url, poster: c.logoPng, type: "tvseries",
      }));
      if (items.length) sections.push({ title: "Conferences", items });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const data = await (await http.get(`${CCC_API}/events?q=${encodeURIComponent(query)}&page=1`)).json<CccEventsResp>();
  return (data?.events || []).map(cccEventToItem).slice(0, 30);
}

export async function load(url: string): Promise<MediaDetail> {
  // Conference URL or event URL
  const isConf = url.includes("/c/");
  if (isConf) {
    const acronym = url.split("/c/").pop() || url.split("/").pop() || "";
    const data = await (await http.get(`${CCC_API}/conferences/${acronym}`)).json<CccConference & { events?: CccEvent[] }>();
    return {
      title: data?.title || acronym, url, poster: data?.logoPng, type: "tvseries",
      episodes: (data?.events || []).map((e, i) => ({ title: e.title, url: e.frontendLink, season: 1, episode: i + 1 })),
    };
  }
  const guid = url.split("/v/").pop() || url.split("/").pop() || "";
  const data = await (await http.get(`${CCC_API}/events/${guid}`)).json<CccEvent & { recording_url_sd?: string; recording_url_hd?: string }>();
  return {
    title: data?.title || guid, url,
    poster: data?.thumbUrl || data?.posterUrl,
    description: data?.description,
    genres: data?.tags || [],
    year: data?.releaseDate ? new Date(data.releaseDate).getFullYear() : undefined,
    type: "video",
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const guid = url.split("/v/").pop() || url.split("/").pop() || "";
  const streams: StreamLink[] = [];
  try {
    const data = await (await http.get(`${CCC_API}/events/${guid}`)).json<{ recordings?: Array<{ url?: string; mime_type?: string; language?: string; height?: number }> }>();
    for (const r of (data?.recordings || [])) {
      if (!r.url) continue;
      const type = r.mime_type?.includes("m3u8") ? "hls" : "video";
      const label = `${r.language || "de"} ${r.height ? r.height + "p" : ""}`.trim();
      streams.push({ url: r.url, label, type });
    }
  } catch { /* fallback */ }
  if (!streams.length) streams.push({ url, label: "C3TV", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "C3TV (MediaCCC)", version: "1.0.0", baseUrl: CCC_BASE, lang: "de",
  type: ["video"], categories: CCC_CATEGORIES.map(c => c.label),
};
