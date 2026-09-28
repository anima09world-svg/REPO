/**
 * Twitch — SkyStream Plugin
 * Converted from TwitchProvider.kt (recloudstream/extensions)
 * Scrapes TwitchTracker for live channel listings
 * Language: Universal | Types: Live
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string }
interface StreamLink { url: string; label?: string; type?: string }

const TW_TRACKER = "https://twitchtracker.com";
const TW_BASE = "https://www.twitch.tv";
const TW_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const TW_CATEGORIES = [
  { label: "Top Live Streams", path: `${TW_TRACKER}/channels/live` },
  { label: "Top Games", path: `${TW_TRACKER}/games` },
  { label: "Just Chatting", path: `${TW_TRACKER}/channels/live#game=Just Chatting` },
];

function twCard(el: Element): MediaItem | null {
  const link = el.querySelector("a[href*='/']") as HTMLAnchorElement | null;
  if (!link) return null;
  const channelSlug = link.href.replace(TW_TRACKER, "").replace(/^\//, "").split("/")[0];
  if (!channelSlug) return null;
  const title = el.querySelector(".name,.channel-name,td:first-child")?.textContent?.trim() || channelSlug;
  const img = el.querySelector("img");
  const poster = img?.src || `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelSlug}-440x248.jpg`;
  return { title, url: `${TW_BASE}/${channelSlug}`, poster, type: "live" };
}

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? TW_CATEGORIES : [TW_CATEGORIES.find(c => c.label === category) || TW_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await (await http.get(cat.path, { headers: { "User-Agent": TW_UA } })).text();
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll("table.table tr[data-channel], .stream-row, .channel-row,.tracker-row"))
        .map(e => twCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items: items.slice(0, 20) });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await (await http.get(`${TW_TRACKER}/streams/search/${encodeURIComponent(query)}`, { headers: { "User-Agent": TW_UA } })).text();
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll("table.table tr,.stream-row,.channel-row"))
    .map(e => twCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const channel = url.replace(TW_BASE + "/", "").split("?")[0];
  const trackerHtml = await (await http.get(`${TW_TRACKER}/${channel}`, { headers: { "User-Agent": TW_UA } })).text();
  const doc = parseHtml(trackerHtml);
  const title = doc.querySelector("h1,.channel-name")?.textContent?.trim() || channel;
  const poster = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-440x248.jpg`;
  const description = doc.querySelector(".channel-description,.bio,.about")?.textContent?.trim();
  return { title, url, poster, description, type: "live" };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  // Twitch HLS requires auth token via GQL. Use embed as fallback.
  const channel = url.replace(TW_BASE + "/", "").split("?")[0];
  return [{ url: `https://player.twitch.tv/?channel=${channel}&parent=skystream.app`, label: "Twitch Live", type: "iframe" }];
}

export const manifest = {
  name: "Twitch", version: "1.0.0", baseUrl: TW_BASE, lang: "uni",
  type: ["live"], categories: TW_CATEGORIES.map(c => c.label),
};
