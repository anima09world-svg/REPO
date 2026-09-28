/**
 * Invidious — SkyStream Plugin
 * Converted from InvidiousProvider.kt (recloudstream/extensions)
 * Uses Invidious public API (privacy-friendly YouTube frontend)
 * Language: Universal | Types: Video
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string; genres?: string[] }
interface StreamLink { url: string; label?: string; type?: string }

// Invidious instances (public, no auth required)
const INV_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.snopyta.org",
  "https://invidious.kavin.rocks",
  "https://y.com.sb",
  "https://invidious.projectsegfau.lt",
];
const INV_CATEGORIES = [
  { label: "Popular", path: "api/v1/popular" },
  { label: "Trending", path: "api/v1/trending" },
  { label: "Trending Music", path: "api/v1/trending?type=music" },
  { label: "Trending Gaming", path: "api/v1/trending?type=gaming" },
  { label: "Trending Movies", path: "api/v1/trending?type=movies" },
];

interface InvVideo { videoId: string; title: string; videoThumbnails?: Array<{ url: string; quality: string }>; description?: string; author?: string }
interface InvStream { url?: string; quality?: string; type?: string; resolution?: string }

async function invFetch<T>(path: string): Promise<T> {
  for (const base of INV_INSTANCES) {
    try {
      const url = path.startsWith("http") ? path : `${base}/${path}`;
      return await (await http.get(url)).json<T>();
    } catch { /* next instance */ }
  }
  throw new Error("All Invidious instances failed");
}

function invToItem(v: InvVideo): MediaItem {
  const thumb = v.videoThumbnails?.find(t => t.quality === "medium") || v.videoThumbnails?.[0];
  return { title: v.title, url: `${INV_INSTANCES[0]}/watch?v=${v.videoId}`, poster: thumb?.url, type: "video" };
}

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? INV_CATEGORIES : [INV_CATEGORIES.find(c => c.label === category) || INV_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const data = await invFetch<InvVideo[]>(cat.path);
      const items = (data || []).map(invToItem);
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const data = await invFetch<InvVideo[]>(`api/v1/search?q=${encodeURIComponent(query)}&type=video`);
  return (data || []).map(invToItem).slice(0, 30);
}

export async function load(url: string): Promise<MediaDetail> {
  const id = new URL(url).searchParams.get("v") || url.split("?v=")[1] || url.split("/").pop() || "";
  const data = await invFetch<InvVideo & { descriptionHtml?: string; genre?: string }[]>(`api/v1/videos/${id}`);
  const v = Array.isArray(data) ? data[0] : (data as unknown as InvVideo & { descriptionHtml?: string });
  const thumb = (v as InvVideo).videoThumbnails?.find(t => t.quality === "maxres") || (v as InvVideo).videoThumbnails?.[0];
  return {
    title: (v as InvVideo).title || "",
    url,
    poster: thumb?.url,
    description: v?.description,
    type: "video",
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const id = new URL(url).searchParams.get("v") || url.split("?v=")[1] || url.split("/").pop() || "";
  const streams: StreamLink[] = [];
  try {
    const data = await invFetch<{ formatStreams?: InvStream[]; adaptiveFormats?: InvStream[] }>(`api/v1/videos/${id}`);
    for (const fmt of (data.formatStreams || [])) {
      if (fmt.url) streams.push({ url: fmt.url, label: fmt.resolution || fmt.quality || "Video", type: "video" });
    }
    for (const fmt of (data.adaptiveFormats || [])) {
      if (fmt.url && fmt.type?.includes("video")) {
        streams.push({ url: fmt.url, label: fmt.resolution || "Adaptive", type: "video" });
      }
    }
  } catch { /* fallback */ }
  if (!streams.length) streams.push({ url: `${INV_INSTANCES[0]}/embed/${id}`, label: "Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "Invidious", version: "1.0.0", baseUrl: INV_INSTANCES[0], lang: "uni",
  type: ["video"], categories: INV_CATEGORIES.map(c => c.label),
};
