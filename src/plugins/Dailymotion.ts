/**
 * Dailymotion — SkyStream Plugin
 * Converted from DailymotionProvider.kt (recloudstream/extensions)
 * Uses Dailymotion public API (no API key required)
 * Language: Universal | Types: Video
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string }
interface StreamLink { url: string; label?: string; type?: string }

const DM_BASE = "https://www.dailymotion.com";
const DM_API = "https://api.dailymotion.com";
const DM_FIELDS = "id,title,thumbnail_360_url,description,duration";
const DM_CATEGORIES = [
  { label: "Trending", path: "videos?sort=trending&fields=" + DM_FIELDS },
  { label: "Most Recent", path: "videos?sort=recent&fields=" + DM_FIELDS },
  { label: "Most Viewed", path: "videos?sort=visited&fields=" + DM_FIELDS },
  { label: "News", path: "channel/news/videos?fields=" + DM_FIELDS },
  { label: "Sport", path: "channel/sport/videos?fields=" + DM_FIELDS },
  { label: "Entertainment", path: "channel/fun/videos?fields=" + DM_FIELDS },
  { label: "Music", path: "channel/music/videos?fields=" + DM_FIELDS },
  { label: "Tech", path: "channel/tech/videos?fields=" + DM_FIELDS },
];

interface DmVideo { id: string; title: string; thumbnail_360_url?: string; description?: string }
interface DmList { list: DmVideo[] }

function dmToItem(v: DmVideo): MediaItem {
  return { title: v.title, url: `${DM_BASE}/video/${v.id}`, poster: v.thumbnail_360_url, type: "video" };
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? DM_CATEGORIES : [DM_CATEGORIES.find(c => c.label === category) || DM_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const data = await (await http.get(`${DM_API}/${cat.path}&limit=20&page=${page}`)).json<DmList>();
      const items = (data.list || []).map(dmToItem);
      if (items.length) sections.push({ title: cat.label, items });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const data = await (await http.get(`${DM_API}/videos?search=${encodeURIComponent(query)}&fields=${DM_FIELDS}&limit=30`)).json<DmList>();
  return (data.list || []).map(dmToItem);
}

export async function load(url: string): Promise<MediaDetail> {
  const idMatch = url.match(/\/video\/([a-z0-9]+)/i);
  const id = idMatch?.[1] || "";
  const data = await (await http.get(`${DM_API}/video/${id}?fields=${DM_FIELDS},url`)).json<DmVideo & { url?: string }>();
  return { title: data.title, url, poster: data.thumbnail_360_url, description: data.description, type: "video" };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const idMatch = url.match(/\/video\/([a-z0-9]+)/i);
  const id = idMatch?.[1] || "";
  // Get playback URL via oEmbed / metadata API
  const streams: StreamLink[] = [];
  try {
    const meta = await (await http.get(`${DM_API}/video/${id}?fields=url,stream_h264_hd_url,stream_h264_url,stream_h264_ld_url,hlsURL`)).json<Record<string, string>>();
    if (meta["hlsURL"]) streams.push({ url: meta["hlsURL"], label: "HLS", type: "hls" });
    if (meta["stream_h264_hd_url"]) streams.push({ url: meta["stream_h264_hd_url"], label: "HD", type: "video" });
    if (meta["stream_h264_url"]) streams.push({ url: meta["stream_h264_url"], label: "SD", type: "video" });
    if (meta["stream_h264_ld_url"]) streams.push({ url: meta["stream_h264_ld_url"], label: "LD", type: "video" });
  } catch { /* API may require auth */ }
  if (!streams.length) streams.push({ url: `https://www.dailymotion.com/embed/video/${id}`, label: "Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "Dailymotion", version: "1.0.0", baseUrl: DM_BASE, lang: "uni",
  type: ["video"], categories: DM_CATEGORIES.map(c => c.label),
};
