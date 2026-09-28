# CloudStream ? SkyStream Converted Plugins

17 media provider plugins converted from **CloudStream 3 Kotlin** to **SkyStream TypeScript**.

## Install

In SkyStream: **Extensions ? Add Source ?**
```
https://raw.githubusercontent.com/anima09world-svg/REPO/main/repo.json
```

---

## ???? French Plugins (from cloudstream-frenchstream)

| Plugin | Source | Types |
|--------|--------|-------|
| **French-Stream** | french-stream.one | Movie, TvSeries |
| **French-Manga** | french-manga.net | Anime |
| **French-Stream TV** | fstv.rest | Live TV |
| **Movix** | movix.date | Movie, TvSeries |

## ?? Universal Plugins (from recloudstream/extensions)

| Plugin | Source | Types |
|--------|--------|-------|
| **YouTube** | youtube.com | Video, Live |
| **Dailymotion** | dailymotion.com | Video |
| **Invidious** | inv.nadeko.net | Video |
| **Twitch** | twitch.tv | Live |
| **Internet Archive** | archive.org | Movie, Video |

## ???? German Plugins (from bnyro/GermanProviders)

| Plugin | Source | Types |
|--------|--------|-------|
| **Aniworld** | aniworld.to | Anime |
| **ARD Mediathek** | ardmediathek.de | Movie, TvSeries, Live |
| **Serienstream** | serienstream.to | TvSeries |
| **HDFilme** | hdfilme.my | Movie |
| **Kinoger** | kinoger.com | Movie, TvSeries |
| **Arte** | arte.tv | Movie, TvSeries |
| **PlutoTV** | pluto.tv | Movie, TvSeries, Live |
| **C3TV (MediaCCC)** | media.ccc.de | Video |

---

## Build

```bash
npm install
node build.js
```

All 17 plugins compile to `dist/*.js`.

## CI/CD

GitHub Actions automatically builds and commits `dist/` on every push to `main`.

---

> **Note:** `cloudstream-extensions-phisher-master.zip` contained documentation only (no Kotlin source files), so no plugin was generated from it.

