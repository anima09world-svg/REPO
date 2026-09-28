/**
 * Arte — SkyStream Plugin
 * Converted from Arte.kt (bnyro/GermanProviders)
 * Source: Arte TV API | Language: German/French | Types: Movie, TvSeries
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const ARTE_BASE = "https://www.arte.tv";
const ARTE_API = "https://api.arte.tv/api/emac/v4/de/web";
const ARTE_CATEGORIES = [
  { label: "Startseite", path: "pages/HOME" },
  { label: "Cinema", path: "pages/CIN" },
  { label: "Serien", path: "pages/SER" },
  { label: "Dokumentation", path: "pages/DOR" },
  { label: "Musik & Pop", path: "pages/CPO" },
  { label: "Kultur", path: "pages/ARS" },
  { label: "Für Kinder", path: "pages/KIN" },
  { label: "News & Gesellschaft", path: "pages/ACT" },
];

interface ArteZone { title?: string; data?: { url?: string; teasers?: ArteTease[] } }
interface ArteTease { title?: string; url?: string; mainImage?: { url?: string }; shortDescription?: string; programId?: string }
interface ArtePage { zones?: ArteZone[] }

function arteToItem(t: ArteTease): MediaItem | null {
  if (!t.title) return null;
  return {
    title: t.title,
    url: t.url ? (t.url.startsWith("http") ? t.url : `${ARTE_BASE}${t.url}`) : `${ARTE_BASE}/de/videos/${t.programId}`,
    poster: t.mainImage?.url?.replace("{w}", "640").replace("{h}", "360") || undefined,
    type: "movie",
  };
}

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? ARTE_CATEGORIES.slice(0, 4) : [ARTE_CATEGORIES.find(c => c.label === category) || ARTE_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const data = await (await http.get(`${ARTE_API}/${cat.path}`)).json<ArtePage>();
      for (const zone of (data?.zones || []).slice(0, 4)) {
        const items = (zone.data?.teasers || []).map(arteToItem).filter(Boolean) as MediaItem[];
        if (items.length) sections.push({ title: zone.title || cat.label, items: items.slice(0, 15) });
      }
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const data = await (await http.get(`${ARTE_API}/pages/SEARCH/?query=${encodeURIComponent(query)}&page=1`)).json<{ zones?: ArteZone[] }>();
  const teasers: ArteTease[] = [];
  for (const z of data?.zones || []) teasers.push(...(z.data?.teasers || []));
  return teasers.map(arteToItem).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  // Try to extract program ID from URL
  const idMatch = url.match(/\/videos?\/([\w-]+)/);
  const id = idMatch?.[1] || url.split("/").pop() || "";
  const data = await (await http.get(`${ARTE_API}/programs/${id}`)).json<ArteTease & { zones?: ArteZone[] }>();
  const episodes: Episode[] = [];
  for (const z of (data?.zones || [])) {
    for (const t of (z.data?.teasers || [])) {
      if (t.url && t.title) episodes.push({ title: t.title, url: t.url.startsWith("http") ? t.url : `${ARTE_BASE}${t.url}`, season: 1, episode: episodes.length + 1 });
    }
  }
  return {
    title: data?.title || id,
    url,
    poster: data?.mainImage?.url?.replace("{w}", "640").replace("{h}", "360") || undefined,
    description: data?.shortDescription,
    episodes: episodes.length ? episodes : undefined,
    type: episodes.length > 1 ? "tvseries" : "movie",
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const idMatch = url.match(/\/videos?\/([\w-]+)/);
  const id = idMatch?.[1] || url.split("/").pop() || "";
  const streams: StreamLink[] = [];
  try {
    const data = await (await http.get(`https://api.arte.tv/api/player/v2/config/de/${id}`)).json<{ data?: { attributes?: { streams?: Array<{ url?: string; maxBitrate?: number }> } } }>();
    for (const s of (data?.data?.attributes?.streams || [])) {
      if (s.url) streams.push({ url: s.url, label: s.maxBitrate ? `${Math.round(s.maxBitrate / 1000)}k` : "HLS", type: "hls" });
    }
  } catch { /* fallback */ }
  if (!streams.length) streams.push({ url: `${ARTE_BASE}/de/videos/${id}`, label: "Arte Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "Arte", version: "1.0.0", baseUrl: ARTE_BASE, lang: "de",
  type: ["movie", "tvseries"], categories: ARTE_CATEGORIES.map(c => c.label),
};
