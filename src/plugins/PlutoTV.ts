/**
 * PlutoTV — SkyStream Plugin
 * Converted from PlutoTV.kt (bnyro/GermanProviders)
 * Source: https://pluto.tv | Language: German | Types: Movie, TvSeries, Live
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const PLUTO_BASE = "https://pluto.tv";
const PLUTO_API = "https://api.pluto.tv/v2";
const PLUTO_BOOT_API = "https://boot.pluto.tv/v4/start?appName=web&appVersion=6&deviceVersion=94.0.0&deviceType=web&deviceMake=Chrome&deviceModel=web&clientID=skystream&clientModelNumber=1&serverSideAds=false&constraints=&drmCapabilities=&clientTime=";
const PLUTO_CATEGORIES = [
  { label: "Live TV", path: "channels" },
  { label: "On Demand", path: "vod/categories" },
  { label: "Filme", path: "vod/categories?lang=de&genre=movies" },
  { label: "Serien", path: "vod/categories?lang=de&genre=television" },
];

interface PlutoChannel { _id: string; name: string; description?: string; thumbnail?: string; stitched?: { urls?: Array<{ url?: string }> } }
interface PlutoVod { _id: string; name: string; summary?: string; coverArt?: string; genre?: string; seasons?: PlutoSeason[] }
interface PlutoSeason { episodes?: PlutoEp[] }
interface PlutoEp { _id: string; name: string; description?: string; stitched?: { urls?: Array<{ url?: string }> } }

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  try {
    if (category === "all" || category === "Live TV") {
      const data = await (await http.get(`${PLUTO_API}/channels?deviceType=web&lang=de&start=0&stop=2`)).json<PlutoChannel[]>();
      const items = (data || []).map(ch => ({
        title: ch.name,
        url: `${PLUTO_BASE}/en/live-tv/${ch._id}`,
        poster: ch.thumbnail,
        type: "live",
      }));
      if (items.length) sections.push({ title: "Live TV", items: items.slice(0, 30) });
    }
    if (category === "all" || category === "On Demand") {
      const data = await (await http.get(`${PLUTO_API}/vod/categories?lang=de&deviceType=web`)).json<PlutoVod[]>();
      const items = (data || []).slice(0, 20).map(v => ({
        title: v.name,
        url: `${PLUTO_BASE}/en/on-demand/movies/${v._id}`,
        poster: v.coverArt,
        type: "movie",
      }));
      if (items.length) sections.push({ title: "On Demand", items });
    }
  } catch { /* skip */ }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const data = await (await http.get(`${PLUTO_API}/search/content?query=${encodeURIComponent(query)}&lang=de&deviceType=web&limit=30`)).json<{ movies?: PlutoVod[]; tvShows?: PlutoVod[] }>();
  const items: MediaItem[] = [];
  for (const v of (data?.movies || [])) items.push({ title: v.name, url: `${PLUTO_BASE}/en/on-demand/movies/${v._id}`, poster: v.coverArt, type: "movie" });
  for (const v of (data?.tvShows || [])) items.push({ title: v.name, url: `${PLUTO_BASE}/en/on-demand/series/${v._id}`, poster: v.coverArt, type: "tvseries" });
  return items;
}

export async function load(url: string): Promise<MediaDetail> {
  const id = url.split("/").pop() || "";
  const isLive = url.includes("live-tv");
  if (isLive) {
    const data = await (await http.get(`${PLUTO_API}/channels/${id}?deviceType=web&lang=de`)).json<PlutoChannel>();
    return { title: data.name, url, poster: data.thumbnail, description: data.description, type: "live" };
  }
  const data = await (await http.get(`${PLUTO_API}/vod/series/${id}?deviceType=web&lang=de`)).json<PlutoVod>();
  const episodes: Episode[] = [];
  for (const s of (data?.seasons || [])) {
    for (const ep of (s.episodes || [])) {
      episodes.push({ title: ep.name, url: `${PLUTO_BASE}/en/on-demand/episode/${ep._id}`, season: 1, episode: episodes.length + 1 });
    }
  }
  return { title: data?.name || id, url, poster: data?.coverArt, description: data?.summary, type: "tvseries", episodes: episodes.length ? episodes : undefined };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const id = url.split("/").pop() || "";
  const isLive = url.includes("live-tv");
  const streams: StreamLink[] = [];
  try {
    if (isLive) {
      const data = await (await http.get(`${PLUTO_API}/channels/${id}?deviceType=web&lang=de`)).json<PlutoChannel>();
      for (const u of (data?.stitched?.urls || [])) if (u.url) streams.push({ url: u.url, label: "HLS", type: "hls" });
    } else {
      const isEp = url.includes("/episode/");
      const endpoint = isEp ? `${PLUTO_API}/vod/episodes/${id}` : `${PLUTO_API}/vod/movies/${id}`;
      const data = await (await http.get(`${endpoint}?deviceType=web&lang=de`)).json<PlutoEp>();
      for (const u of (data?.stitched?.urls || [])) if (u.url) streams.push({ url: u.url, label: "HLS", type: "hls" });
    }
  } catch { /* fallback */ }
  if (!streams.length) streams.push({ url, label: "PlutoTV", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "PlutoTV", version: "1.0.0", baseUrl: PLUTO_BASE, lang: "de",
  type: ["movie", "tvseries", "live"], categories: PLUTO_CATEGORIES.map(c => c.label),
};
