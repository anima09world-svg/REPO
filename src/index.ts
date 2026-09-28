/**
 * SkyStream Multi-Plugin Registry
 * ============================================================
 * Converted from 4 CloudStream 3 plugin collections:
 *   - cloudstream-frenchstream (French media)
 *   - recloudstream/extensions (Universal video)
 *   - bnyro/GermanProviders (German media)
 *   - cloudstream-extensions-phisher (docs only, no sources)
 *
 * Each provider is a fully independent SkyStream plugin.
 * This file registers all of them with SkyStream plugin loader.
 */

// French Stream Collection
export * as FrenchStream    from './plugins/FrenchStream';
export * as FrenchManga     from './plugins/FrenchManga';
export * as FSTV            from './plugins/FSTV';
export * as Movix           from './plugins/Movix';

// Universal / English Collection
export * as YouTube         from './plugins/YouTube';
export * as Dailymotion     from './plugins/Dailymotion';
export * as Invidious       from './plugins/Invidious';
export * as Twitch          from './plugins/Twitch';
export * as InternetArchive from './plugins/InternetArchive';

// German Providers Collection
export * as Aniworld        from './plugins/Aniworld';
export * as ARD             from './plugins/ARD';
export * as Serienstream    from './plugins/Serienstream';
export * as HDFilme         from './plugins/HDFilme';
export * as Kinoger         from './plugins/Kinoger';
export * as Arte            from './plugins/Arte';
export * as PlutoTV         from './plugins/PlutoTV';
export * as MediaCCC        from './plugins/MediaCCC';
