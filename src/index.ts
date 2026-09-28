/**
 * Mega Repo — SkyStream Plugin
 *
 * Converted from: MegaPlugin.kt (CloudStream 3 / Android)
 * Original source: https://github.com/recloudstream/cs-repos
 *
 * What it does:
 *   - Fetches the community cs-repos database JSON
 *   - Presents each repository as a browsable MultimediaItem card
 *   - Supports search/filter by repo URL or name
 *   - load() fetches a repo's own repo.json and lists its individual plugins
 *   - loadStreams() is a no-op (repo manager plugin, not a media plugin)
 *
 * Architecture Notes:
 *   - manifest.baseUrl points to the raw GitHub path defined in plugin.json
 *   - All URLs are constructed from manifest.baseUrl so mirror switching works
 */

// ---------------------------------------------------------------------------
// Type declarations for SkyStream globals
// ---------------------------------------------------------------------------

declare const manifest: {
  baseUrl: string;
  providerId?: string;
};

declare class MultimediaItem {
  constructor(opts: {
    title: string;
    url: string;
    posterUrl?: string;
    type: string;
    description?: string;
    year?: number;
    score?: number;
  });
}

// ---------------------------------------------------------------------------
// Internal types mirroring the original Kotlin data classes
// ---------------------------------------------------------------------------

interface VerifiedRepo {
  url?: string;
  verified?: boolean;
}

interface RepoPlugin {
  internalName?: string;
  name?: string;
  version?: number;
  authors?: string[];
  description?: string;
  repositoryUrl?: string;
  fileSize?: number;
  iconUrl?: string;
  apiVersion?: number;
  tvTypes?: string[];
  language?: string;
  status?: number;
}

interface RepoManifest {
  name?: string;
  description?: string;
  manifestVersion?: number;
  pluginLists?: string[];
  iconUrl?: string;
  plugins?: RepoPlugin[];
}

// ---------------------------------------------------------------------------
// Helper: fetch JSON safely
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: parse repos-db.json — mixed array of strings and {url,verified}
// This mirrors the original Kotlin plugin logic exactly.
// ---------------------------------------------------------------------------

async function getRepositoryUrls(): Promise<string[]> {
  const dbUrl = `${manifest.baseUrl}/repos-db.json`;
  const raw = await fetchJson<Array<string | VerifiedRepo>>(dbUrl);
  if (!raw || !Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry === "object" && entry !== null && entry.url)
        return entry.url;
      return null;
    })
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

// ---------------------------------------------------------------------------
// Helper: derive a display name from a repo URL
// e.g. "https://raw.githubusercontent.com/SaurabhKaperwan/CSX/builds/CS.json"
//   -> "CSX  •  SaurabhKaperwan"
// ---------------------------------------------------------------------------

function repoDisplayName(url: string): string {
  try {
    const match = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//);
    if (match) return `${match[2]}  •  ${match[1]}`;
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[1]}  •  ${parts[0]}`;
    return u.hostname;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Helper: poster URL from repo manifest icon, GitHub avatar, or fallback
// ---------------------------------------------------------------------------

const FALLBACK_ICON =
  "https://raw.githubusercontent.com/recloudstream/cloudstream/master/app/src/main/ic_launcher-playstore.png";

function repoPoster(repoManifest: RepoManifest | null, repoUrl: string): string {
  if (repoManifest?.iconUrl) return repoManifest.iconUrl;
  try {
    const match = repoUrl.match(/githubusercontent\.com\/([^/]+)\//);
    if (match) return `https://github.com/${match[1]}.png`;
  } catch { /* ignore */ }
  return FALLBACK_ICON;
}

// ---------------------------------------------------------------------------
// 1. getHome — Dashboard: shows all repos split into Verified / Community
// ---------------------------------------------------------------------------

async function getHome(
  cb: (result: {
    success: boolean;
    data?: Record<string, MultimediaItem[]>;
    errorCode?: string;
    message?: string;
  }) => void
): Promise<void> {
  const urls = await getRepositoryUrls();
  if (urls.length === 0) {
    return cb({ success: false, errorCode: "NOT_FOUND", message: "Could not fetch the repository database." });
  }

  // Fetch each repo manifest in parallel (best-effort, failures become null)
  const manifests = await Promise.all(urls.map((url) => fetchJson<RepoManifest>(url)));

  // Re-fetch raw db to determine which repos carry the verified flag
  const dbRaw = await fetchJson<Array<string | VerifiedRepo>>(`${manifest.baseUrl}/repos-db.json`);
  const verifiedUrls = new Set<string>();
  if (Array.isArray(dbRaw)) {
    dbRaw.forEach((entry) => {
      if (typeof entry === "object" && entry !== null && entry.verified && entry.url) {
        verifiedUrls.add(entry.url);
      }
    });
  }

  const verified: MultimediaItem[] = [];
  const community: MultimediaItem[] = [];

  urls.forEach((url, i) => {
    const repoMeta = manifests[i];
    const name = repoMeta?.name || repoDisplayName(url);
    const poster = repoPoster(repoMeta, url);
    const desc = repoMeta?.description || `Repository: ${url}\nClick to browse plugins.`;
    const item = new MultimediaItem({ title: name, url, posterUrl: poster, type: "series", description: desc });
    if (verifiedUrls.has(url)) verified.push(item);
    else community.push(item);
  });

  // Trending carousel = verified repos first, then community, capped at 10
  const trending = [...verified, ...community].slice(0, 10);

  return cb({
    success: true,
    data: {
      Trending: trending,
      "✅ Verified Repos": verified,
      "🌐 Community Repos": community,
    },
  });
}

// ---------------------------------------------------------------------------
// 2. search — Filter repos by name or URL substring
// ---------------------------------------------------------------------------

async function search(
  query: string,
  cb: (result: {
    success: boolean;
    data?: MultimediaItem[];
    errorCode?: string;
    message?: string;
  }) => void
): Promise<void> {
  const urls = await getRepositoryUrls();
  const q = query.toLowerCase().trim();
  const matched = urls.filter(
    (url) => url.toLowerCase().includes(q) || repoDisplayName(url).toLowerCase().includes(q)
  );
  if (matched.length === 0) return cb({ success: true, data: [] });

  const manifests = await Promise.all(matched.map((url) => fetchJson<RepoManifest>(url)));
  const results = matched.map((url, i) => {
    const repoMeta = manifests[i];
    return new MultimediaItem({
      title: repoMeta?.name || repoDisplayName(url),
      url,
      posterUrl: repoPoster(repoMeta, url),
      type: "series",
      description: repoMeta?.description || `Repository URL: ${url}`,
    });
  });
  return cb({ success: true, data: results });
}

// ---------------------------------------------------------------------------
// 3. load — Fetch a repo's own repo.json and list its plugins
//    url = the repo.json URL chosen by the user from getHome or search
// ---------------------------------------------------------------------------

async function load(
  url: string,
  cb: (result: {
    success: boolean;
    data?: object;
    errorCode?: string;
    message?: string;
  }) => void
): Promise<void> {
  const repoMeta = await fetchJson<RepoManifest>(url);
  if (!repoMeta) {
    return cb({ success: false, errorCode: "NOT_FOUND", message: `Could not load repository: ${url}` });
  }

  const repoName = repoMeta.name || repoDisplayName(url);
  const poster = repoPoster(repoMeta, url);
  const plugins: RepoPlugin[] = repoMeta.plugins || [];

  const episodes = plugins.map((plugin, idx) => {
    const pluginName = plugin.name || plugin.internalName || `Plugin ${idx + 1}`;
    const authors = plugin.authors?.join(", ") || "Unknown";
    const tvTypes = plugin.tvTypes?.join(", ") || "";
    const lang = plugin.language ? ` [${plugin.language.toUpperCase()}]` : "";
    return {
      name: `${pluginName}${lang}`,
      url: plugin.repositoryUrl || url,
      season: 1,
      episode: idx + 1,
      rating: plugin.version ?? 0,
      dubStatus: "none",
      playbackPolicy: tvTypes ? `Types: ${tvTypes} | By: ${authors}` : `By: ${authors}`,
    };
  });

  return cb({
    success: true,
    data: {
      title: repoName,
      url,
      posterUrl: poster,
      type: "series",
      description: repoMeta.description || `Browse ${plugins.length} plugin(s) from ${repoName}`,
      episodes,
    },
  });
}

// ---------------------------------------------------------------------------
// 4. loadStreams — No-op: this plugin manages repositories, not media streams
// ---------------------------------------------------------------------------

async function loadStreams(
  _url: string,
  cb: (result: { success: boolean; data: object[] }) => void
): Promise<void> {
  return cb({ success: true, data: [] });
}

// ---------------------------------------------------------------------------
// Export to SkyStream runtime
// ---------------------------------------------------------------------------

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;

