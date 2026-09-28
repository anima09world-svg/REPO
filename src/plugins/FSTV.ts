/**
 * FSTV — SkyStream Plugin
 * Converted from FSTVProvider.kt (cloudstream-frenchstream)
 * Source: https://fstv.rest | Language: French | Types: Live TV
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string> }> };
declare function parseHtml(html: string): Document;
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string }
interface MediaDetail extends MediaItem { description?: string; streams?: StreamLink[] }
interface StreamLink { url: string; label?: string; type?: string; headers?: Record<string, string> }

const FSTV_BASE = "https://fstv.rest";
const FSTV_PORTAL = "https://fstream.info";
const FSTV_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const FSTV_CATEGORIES = [
  { label: "Généralistes", slug: "generalistes" },
  { label: "Info & Sports", slug: "info-sports" },
  { label: "Cinéma & Séries", slug: "cinema-series" },
  { label: "Jeunesse", slug: "jeunesse" },
  { label: "Documentaires", slug: "documentaires" },
  { label: "Musique", slug: "musique" },
  { label: "International", slug: "international" },
];

async function fstvFetch(url: string): Promise<string> {
  const res = await http.get(url, { headers: { "User-Agent": FSTV_UA, "Referer": FSTV_BASE } });
  return res.text();
}

function fstvCard(el: Element): MediaItem | null {
  const link = el.querySelector("a") as HTMLAnchorElement | null;
  if (!link) return null;
  const title = el.querySelector(".channel-name,.name,span.title")?.textContent?.trim() || link.title || "";
  const img = el.querySelector("img");
  const poster = img?.src || img?.getAttribute("data-src") || undefined;
  return { title, url: link.href, poster, type: "live" };
}

export async function getHome(_page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? FSTV_CATEGORIES : [FSTV_CATEGORIES.find(c => c.label === category) || FSTV_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const html = await fstvFetch(`${FSTV_BASE}/category/${cat.slug}`);
      const doc = parseHtml(html);
      const items = Array.from(doc.querySelectorAll(".channel-item,.tv-channel,.stream-item"))
        .map(e => fstvCard(e)).filter(Boolean) as MediaItem[];
      if (items.length) sections.push({ title: cat.label, items });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const html = await fstvFetch(`${FSTV_BASE}/?s=${encodeURIComponent(query)}`);
  const doc = parseHtml(html);
  return Array.from(doc.querySelectorAll(".channel-item,.tv-channel,.stream-item"))
    .map(e => fstvCard(e)).filter(Boolean) as MediaItem[];
}

export async function load(url: string): Promise<MediaDetail> {
  const html = await fstvFetch(url);
  const doc = parseHtml(html);
  const title = doc.querySelector("h1,.channel-title")?.textContent?.trim() || "";
  const poster = (doc.querySelector(".channel-logo img") as HTMLImageElement)?.src || undefined;
  const description = doc.querySelector(".channel-desc,.description")?.textContent?.trim();
  return { title, url, poster, description };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const html = await fstvFetch(url);
  const streams: StreamLink[] = [];
  // HLS streams embedded
  const hlsMatches = html.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/g) || [];
  for (const m of hlsMatches) streams.push({ url: m.replace(/"/g, ""), label: "Live HLS", type: "hls" });
  // Iframe embeds
  const iframes = Array.from(parseHtml(html).querySelectorAll("iframe[src]"));
  for (const iframe of iframes) {
    const src = iframe.getAttribute("src") || "";
    if (src.startsWith("http")) streams.push({ url: src, label: "Live Embed", type: "iframe" });
  }
  // Try portal redirect
  if (!streams.length) {
    try {
      const portalHtml = await fstvFetch(`${FSTV_PORTAL}/live/${encodeURIComponent(url.split("/").pop() || "")}`);
      const m3u = portalHtml.match(/"(https?:\/\/[^"]+\.m3u8[^"]*)"/);
      if (m3u) streams.push({ url: m3u[1], label: "Live", type: "hls" });
    } catch { /* ignore */ }
  }
  return streams;
}

export const manifest = {
  name: "French-Stream TV", version: "1.0.0", baseUrl: FSTV_BASE, lang: "fr",
  type: ["live"], categories: FSTV_CATEGORIES.map(c => c.label),
};
