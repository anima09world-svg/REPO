/**
 * InternetArchive — SkyStream Plugin
 * Converted from InternetArchiveProvider.kt (recloudstream/extensions)
 * Source: https://archive.org | Language: Universal | Types: Movie, TvSeries, Video
 */
declare const http: { get(url: string, opts?: Record<string, unknown>): Promise<{ text(): Promise<string>; json<T>(): Promise<T> }> };
interface HomeSection { title: string; items: MediaItem[] }
interface MediaItem { title: string; url: string; poster?: string; type?: string; year?: number }
interface MediaDetail extends MediaItem { description?: string; genres?: string[]; episodes?: Episode[] }
interface Episode { title: string; url: string; season?: number; episode?: number }
interface StreamLink { url: string; label?: string; type?: string }

const IA_BASE = "https://archive.org";
const IA_API = "https://archive.org/advancedsearch.php";
const IA_CATEGORIES = [
  { label: "Feature Films", query: "mediatype:movies AND subject:feature" },
  { label: "Short Films", query: "mediatype:movies AND subject:shorts" },
  { label: "Silent Films", query: "mediatype:movies AND subject:silent" },
  { label: "TV Shows", query: "mediatype:movies AND subject:television" },
  { label: "Documentaries", query: "mediatype:movies AND subject:documentary" },
  { label: "Animation", query: "mediatype:movies AND subject:animation" },
  { label: "Lectures & Talks", query: "mediatype:movies AND subject:lectures" },
  { label: "Educational", query: "mediatype:movies AND description:educational" },
];

interface IaDoc { identifier: string; title?: string; description?: string; year?: number; subject?: string | string[] }
interface IaResp { response: { docs: IaDoc[] } }

function iaToItem(doc: IaDoc): MediaItem {
  const poster = `${IA_BASE}/services/img/${doc.identifier}`;
  const year = typeof doc.year === "number" ? doc.year : parseInt(String(doc.year || "")) || undefined;
  return { title: doc.title || doc.identifier, url: `${IA_BASE}/details/${doc.identifier}`, poster, type: "movie", year };
}

async function iaSearch(query: string, extra = "", page = 1): Promise<IaDoc[]> {
  const q = encodeURIComponent(query + (extra ? " AND " + extra : ""));
  const url = `${IA_API}?q=${q}&fl[]=identifier,title,description,year,subject&sort=downloads+desc&rows=24&page=${page}&output=json`;
  const data = await (await http.get(url)).json<IaResp>();
  return data?.response?.docs || [];
}

export async function getHome(page: number, category: string): Promise<HomeSection[]> {
  const sections: HomeSection[] = [];
  const cats = category === "all" ? IA_CATEGORIES : [IA_CATEGORIES.find(c => c.label === category) || IA_CATEGORIES[0]];
  for (const cat of cats) {
    try {
      const docs = await iaSearch(cat.query, "", page);
      const items = docs.map(iaToItem);
      if (items.length) sections.push({ title: cat.label, items });
    } catch { /* skip */ }
  }
  return sections;
}

export async function search(query: string): Promise<MediaItem[]> {
  const docs = await iaSearch(query, "mediatype:movies");
  return docs.map(iaToItem).slice(0, 30);
}

export async function load(url: string): Promise<MediaDetail> {
  const id = url.replace(`${IA_BASE}/details/`, "").split("/")[0];
  const meta = await (await http.get(`${IA_BASE}/metadata/${id}`)).json<{ metadata?: IaDoc; files?: Array<{ name: string; format?: string; size?: string }> }>();
  const m = meta?.metadata || {} as IaDoc;
  const genres = Array.isArray(m.subject) ? m.subject : (m.subject ? [m.subject] : []);
  const files = (meta?.files || []).filter(f => /mp4|ogv|mpeg|avi|mkv|webm/i.test(f.format || "") || /mp4|ogv|mpeg|avi|mkv|webm/i.test(f.name));
  const episodes: Episode[] = files.map((f, i) => ({
    title: f.name.replace(/\.[^.]+$/, ""),
    url: `${IA_BASE}/download/${id}/${encodeURIComponent(f.name)}`,
    season: 1,
    episode: i + 1,
  }));
  return {
    title: m.title || id,
    url,
    poster: `${IA_BASE}/services/img/${id}`,
    description: m.description,
    genres,
    year: typeof m.year === "number" ? m.year : parseInt(String(m.year || "")) || undefined,
    episodes: episodes.length > 1 ? episodes : undefined,
  };
}

export async function loadStreams(url: string): Promise<StreamLink[]> {
  const id = url.replace(`${IA_BASE}/details/`, "").split("/")[0];
  const streams: StreamLink[] = [];
  const meta = await (await http.get(`${IA_BASE}/metadata/${id}`)).json<{ files?: Array<{ name: string; format?: string }> }>();
  for (const f of (meta?.files || [])) {
    const ext = f.name.match(/\.(mp4|ogv|mkv|avi|webm)$/i);
    if (ext) {
      const furl = `${IA_BASE}/download/${id}/${encodeURIComponent(f.name)}`;
      const label = f.format || ext[1].toUpperCase();
      streams.push({ url: furl, label, type: ext[1] === "mp4" ? "video" : "video" });
    }
  }
  if (!streams.length) streams.push({ url: `${IA_BASE}/embed/${id}`, label: "Archive Embed", type: "iframe" });
  return streams;
}

export const manifest = {
  name: "Internet Archive", version: "1.0.0", baseUrl: IA_BASE, lang: "uni",
  type: ["movie", "tvseries", "video"], categories: IA_CATEGORIES.map(c => c.label),
};
