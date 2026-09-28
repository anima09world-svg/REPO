# SkyStream — Mega Repo Plugin

A SkyStream plugin converted from the original [MegaProvider](https://github.com/recloudstream/cs-repos) CloudStream 3 plugin.

Fetches the community repository database and lets users browse, search, and explore CloudStream-compatible repositories and their plugins directly inside SkyStream.

## 📦 Install in SkyStream

Once deployed, open **SkyStream → Extensions → Add Source** and paste:

```
https://raw.githubusercontent.com/anima09world-svg/REPO/main/repo.json
```

## ✨ Features

| Function | Behaviour |
|---|---|
| `getHome` | Loads the full repos-db.json — splits repos into **✅ Verified** and **🌐 Community** rows with a hero carousel |
| `search` | Filter repos by name or URL keyword |
| `load` | Opens a single repo's `repo.json` and lists every plugin inside it |
| `loadStreams` | No-op — this is a repository browser, not a media plugin |

## 🛠 Local Development

```bash
npm install
skystream test -f getHome
skystream test -f search -q "phisher"
skystream test -f load -q "https://raw.githubusercontent.com/recloudstream/extensions/master/repo.json"
```

## 🚀 Deployment

Push to `main` — GitHub Actions automatically runs `skystream deploy` and commits the generated `repo.json` and `.sky` files back to the repo.

## Credits

- Original plugin: MegaPlugin.kt by the CloudStream community
- Repo database: `https://raw.githubusercontent.com/recloudstream/cs-repos/master/repos-db.json`
