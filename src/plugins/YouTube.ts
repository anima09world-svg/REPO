/**
 * YouTube — SkyStream Plugin
 * Converted from YoutubeProvider.kt (recloudstream/extensions)
 * Uses YouTube's public search & oEmbed APIs (no API key needed)
 * Language: Universal | Types: Video, Live
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string }
interface StreamLink { url: string; label?: string; type?: string }

const YT_BASE = "https://www.youtube.com";
const YT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const YT_CATEGORIES = [
  { label: "Trending", path: "feed/trending" },
  { label: "Movies & Shows", path: "feed/trending?bp=4gINGgt5dG1hX3RyZW5kaW5nMoIBCWxvY2FsaXphdGlvbv8B" },
  { label: "Music", path: "feed/trending?bp=4gINGgt5dG1hX3RyZW5kaW5nMoIBCmxvY2FsaXphdGlvbv8B" },
  { label: "Gaming", path: "feed/trending?bp=4gINGgt5dG1hX3RyZW5kaW5nMoIBC2xvY2FsaXphdGlvbv8B" },
  { label: "Live", path: "live" },
];

interface YtVideo { title?: string; videoId?: string; thumbnail?: Array<{ url: string }>; shortDescription?: string; publishedTime?: string }
interface YtInitial { contents?: unknown }

function extractYtVideos(html: string): MediaItem[] {
  const items: MediaItem[] = [];
  // Extract ytInitialData JSON
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*(?:var |<\/script>)/s);
  if (!match) return items;
  try {
    const data = JSON.parse(match[1]) as Record<string, unknown>;
    const renderers = JSON.stringify(data).match(/"videoRenderer":\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
    for (const r of renderers.slice(0, 24)) {
      try {
        const obj = JSON.parse(`{${r}`) as Record<string, unknown>;
        const vr = (obj["videoRenderer"] || {}) as YtVideo;
        const id = (vr as Record<string, unknown>)?.["videoId"] as string || "";
        if (!id) continue;
        const titleObj = (vr as Record<string, unknown>)?.["title"] as Record<string, unknown>;
        const title: string = (titleObj?.["runs"] as Array<{text?: string}>)?.[0]?.text || (titleObj?.["simpleText"] as string) || "";
        const thumb = ((vr as Record<string, unknown>)?.["thumbnail"] as { thumbnails?: Array<{ url: string }> })?.thumbnails || [];
        const poster = thumb[thumb.length - 1]?.url;
        items.push({ title, url: `${YT_BASE}/watch?v=${id}`, poster, type: "video" });
      } catch { /* skip malformed */ }
    }
  } catch { /* invalid JSON */ }
  return items;
}

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? YT_CATEGORIES : [YT_CATEGORIES.find(c => c.label === category) || YT_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await (await http.get(`${YT_BASE}/${cat.path}`, { headers: { "User-Agent": YT_UA } })).text();
      const items = extractYtVideos(html);
      if (items.length) sections.push({ title: cat.label, items });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await (await http.get(`${YT_BASE}/results?search_query=${encodeURIComponent(query)}`, { headers: { "User-Agent": YT_UA } })).text();
  return extractYtVideos(html);
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await (await http.get(url, { headers: { "User-Agent": YT_UA } })).text();
  const titleMatch = html.match(/<meta name="title" content="([^"]+)"/);
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/);
  const thumbMatch = html.match(/"url":"(https:\/\/i\.ytimg\.com\/vi\/[^"]+\/maxresdefault[^"]*)"/);
  return {
    title: titleMatch?.[1] || "",
    url,
    poster: thumbMatch?.[1]?.replace(/\\u0026/g, "&") || undefined,
    description: descMatch?.[1] || undefined,
    type: "video",
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  // YouTube requires youtube-dl / yt-dlp for stream extraction
  // Use Invidious API as fallback
  const videoId = new URL(url).searchParams.get("v") || url.split("/").pop() || "";
  const streams: StreamLink[] = [];
  const invInstances = ["https://inv.nadeko.net", "https://invidious.snopyta.org"];
  for (const inv of invInstances) {
    try {
      const data = await (await http.get(`${inv}/api/v1/videos/${videoId}`)).json<Record<string, unknown>>();
      const fmts = (data["formatStreams"] as Array<{ url?: string; quality?: string; type?: string }>) || [];
      for (const f of fmts) {
        if (f.url) streams.push({ url: f.url, label: f.quality || "Stream", type: "video" });
      }
      if (streams.length) break;
    } catch { /* next instance */ }
  }
  if (!streams.length) streams.push({ url: `${YT_BASE}/embed/${videoId}`, label: "YouTube Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "YouTube", version: "1.0.0", baseUrl: YT_BASE, lang: "uni",
  type: ["video", "live"], categories: YT_CATEGORIES.map(c => c.label),
};
