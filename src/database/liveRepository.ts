import { initDatabase } from './database';

import {
XtreamClient,
XtreamLiveCategory,
XtreamLiveChannel,
} from '../api/xtreamClient';
import { Channel } from '../types/live';
import { xtreamConfig } from '../api/config';
const client = new XtreamClient(xtreamConfig);

/*
CACHE DES LOGOS

*/

const liveIconCache = new Map<number, string>();

/*
PROGRESSION

*/

export type LiveSyncProgress = {
phase: 'categories' | 'channels' | 'completed';
current: number;
total: number;
};

/*
SYNCHRONISATION DES CATÉGORIES LIVE

*/

export async function syncLiveCategories(): Promise<number> {
const db = await initDatabase();

console.log('RÉCUPÉRATION DES CATÉGORIES LIVE...');

const categories: XtreamLiveCategory[] =
await client.getLiveCategories();

console.log(
'CATÉGORIES LIVE RÉCUPÉRÉES :',
categories.length
);

/*
UPSERT

*/

for (const category of categories) {
await db.runAsync(
'INSERT INTO live_categories ' +
'(category_id, category_name, parent_id) ' +
'VALUES (?, ?, ?) ' +
'ON CONFLICT(category_id) DO UPDATE SET ' +
'category_name = excluded.category_name, ' +
'parent_id = excluded.parent_id;',
[
category.category_id,
category.category_name,
category.parent_id ?? 0,
]
);
}

console.log(
'UPSERT CATÉGORIES LIVE TERMINÉ :',
categories.length
);

return categories.length;
}

/*
SYNCHRONISATION DES CHAÎNES LIVE

*/

export async function syncLiveChannels( onProgress?: ( current: number, total: number ) => void, serverChannels?: XtreamLiveChannel[] ): Promise<number> { const db = await initDatabase(); console.log('RÉCUPÉRATION DES CHAÎNES LIVE...'); const channels: XtreamLiveChannel[] = serverChannels ?? await client.getLiveStreams(); console.log( 'CHAÎNES LIVE RÉCUPÉRÉES :', channels.length ); const total = channels.length; const BATCH_SIZE = 500; let current = 0; for ( let start = 0; start < total; start += BATCH_SIZE ) { const batch = channels.slice( start, start + BATCH_SIZE ); await db.withTransactionAsync(async () => { for (const channel of batch) { /* ======================================================== CACHE DU LOGO ======================================================== */ if (channel.stream_icon) { liveIconCache.set( channel.stream_id, channel.stream_icon ); } /* ======================================================== UPSERT DE LA CHAÎNE ======================================================== */ await db.runAsync( 'INSERT INTO live_channels ' + '(' + 'stream_id, ' + 'num, ' + 'name, ' + 'stream_type, ' + 'epg_channel_id, ' + 'added, ' + 'is_adult, ' + 'category_id, ' + 'custom_sid, ' + 'tv_archive, ' + 'direct_source, ' + 'tv_archive_duration' + ') ' + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' + 'ON CONFLICT(stream_id) DO UPDATE SET ' + 'num = excluded.num, ' + 'name = excluded.name, ' + 'stream_type = excluded.stream_type, ' + 'epg_channel_id = excluded.epg_channel_id, ' + 'added = excluded.added, ' + 'is_adult = excluded.is_adult, ' + 'category_id = excluded.category_id, ' + 'custom_sid = excluded.custom_sid, ' + 'tv_archive = excluded.tv_archive, ' + 'direct_source = excluded.direct_source, ' + 'tv_archive_duration = excluded.tv_archive_duration;', [ channel.stream_id, channel.num ?? null, channel.name, channel.stream_type ?? null, channel.epg_channel_id ?? null, channel.added ?? null, channel.is_adult ?? null, channel.category_id ?? null, channel.custom_sid ?? null, channel.tv_archive ?? 0, channel.direct_source ?? null, channel.tv_archive_duration ?? 0, ] ); } }); current += batch.length; if ( current === BATCH_SIZE || current === total || current % BATCH_SIZE === 0 ) { onProgress?.( current, total ); console.log( 'CHAÎNES LIVE UPSERT :', current, '/', total ); } } console.log( 'UPSERT CHAÎNES LIVE TERMINÉ :', current ); return current; }
/*
SYNCHRONISATION COMPLÈTE LIVE TV

*/
export async function getLiveCategoriesCount(): Promise<number> {
  const db = await initDatabase();

  const result =
    await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM live_categories;'
    );

  return Number(result?.count ?? 0);
}

export async function syncLiveTVIfNeeded( onProgress?: ( progress: LiveSyncProgress ) => void ) { const db = await initDatabase(); console.log('================================'); console.log('VÉRIFICATION LIVE TV'); console.log('================================'); /* ============================================================ RÉCUPÉRATION SERVEUR ============================================================ */ console.log( 'RÉCUPÉRATION DU NOMBRE DE CHAÎNES SERVEUR...' ); const serverChannels = await client.getLiveStreams(); const serverCount = serverChannels.length; /* ============================================================ NOMBRE SQLITE ============================================================ */ const result = await db.getFirstAsync<{ count: number }>( 'SELECT COUNT(*) AS count FROM live_channels;' ); const sqliteCount = Number(result?.count ?? 0); console.log( 'NOMBRE CHAÎNES SERVEUR :', serverCount ); console.log( 'NOMBRE CHAÎNES SQLITE :', sqliteCount ); /* ============================================================ MÊME NOMBRE ============================================================ */ if ( serverCount === sqliteCount && sqliteCount > 0 ) { console.log( '================================' ); console.log( 'NOMBRE IDENTIQUE' ); console.log( 'AUCUNE SYNCHRONISATION DES CHAÎNES' ); console.log( 'ACTUALISATION DU CACHE DES LOGOS' ); console.log( '================================' ); /* ======================================================== CACHE DES LOGOS UNIQUEMENT ======================================================== */ let iconsLoaded = 0; for (const channel of serverChannels) { if (channel.stream_icon) { liveIconCache.set( channel.stream_id, channel.stream_icon ); iconsLoaded++; } } console.log( 'LOGOS MIS EN CACHE :', iconsLoaded ); return { synchronized: false, serverCount, sqliteCount, categoriesCount: await getLiveCategoriesCount(), channelsCount: sqliteCount, }; } /* ============================================================ NOMBRE DIFFÉRENT ============================================================ */ console.log( '================================' ); console.log( 'NOMBRE DIFFÉRENT' ); console.log( 'SYNCHRONISATION NÉCESSAIRE' ); console.log( '================================' ); /* ============================================================ CATÉGORIES ============================================================ */ const categoriesCount = await syncLiveCategories(); onProgress?.({ phase: 'categories', current: categoriesCount, total: categoriesCount, }); /* ============================================================ CHAÎNES ============================================================ */ const channelsCount = await syncLiveChannels( (current, total) => { onProgress?.({ phase: 'channels', current, total, }); }, serverChannels ); /* ============================================================ TERMINÉ ============================================================ */ onProgress?.({ phase: 'completed', current: channelsCount, total: channelsCount, }); console.log( '================================' ); console.log( 'LIVE TV SYNCHRONISÉ' ); console.log( 'CATÉGORIES :', categoriesCount ); console.log( 'CHAÎNES :', channelsCount ); console.log( '================================' ); return { synchronized: true, serverCount, sqliteCount, categoriesCount, channelsCount, }; }



export async function syncLiveTV(
onProgress?: (
progress: LiveSyncProgress
) => void
) {
console.log('================================');
console.log('DÉBUT SYNCHRONISATION LIVE TV');
console.log('================================');

/*
CATÉGORIES

*/

const categoriesCount =
await syncLiveCategories();

onProgress?.({
phase: 'categories',
current: categoriesCount,
total: categoriesCount,
});

/*
CHAÎNES

*/

const channelsCount =
await syncLiveChannels(
(current, total) => {
onProgress?.({
phase: 'channels',
current,
total,
});
}
);

/*
TERMINÉ

*/

onProgress?.({
phase: 'completed',
current: channelsCount,
total: channelsCount,
});

console.log('================================');
console.log('LIVE TV SYNCHRONISÉ');
console.log('CATÉGORIES :', categoriesCount);
console.log('CHAÎNES :', channelsCount);
console.log('================================');

return {
categoriesCount,
channelsCount,
};
}

/*
CATÉGORIES DEPUIS SQLITE

*/

export async function getLiveCategoriesFromDatabase(): Promise<
  {
    category_id: string;
    category_name: string;
    parent_id: number;
  }[]
> {
  const db = await initDatabase();

  const result = await db.getAllAsync<{
    category_id: string;
    category_name: string;
    parent_id: number;
  }>(
    'SELECT ' +
      'category_id, ' +
      'category_name, ' +
      'parent_id ' +
      'FROM live_categories ' +
      'ORDER BY category_name ASC;'
  );

  console.log(
    'CATÉGORIES LIVE LUES DEPUIS SQLITE :',
    result.length
  );

  return result;
}

/*
CHAÎNES DEPUIS SQLITE

*/
export async function getLiveChannelsFromDatabase(
  categoryId?: string,
  limit = 100,
  offset = 0
): Promise<Channel[]> {
  const db = await initDatabase();

  /*
  UNE CATÉGORIE
  */

  if (categoryId) {
    const result = await db.getAllAsync<Channel>(
      'SELECT ' +
        'stream_id, ' +
        'num, ' +
        'name, ' +
        'stream_type, ' +
        'epg_channel_id, ' +
        'added, ' +
        'is_adult, ' +
        'category_id, ' +
        'custom_sid, ' +
        'tv_archive, ' +
        'direct_source, ' +
        'tv_archive_duration ' +
        'FROM live_channels ' +
        'WHERE category_id = ? ' +
        'ORDER BY name COLLATE NOCASE ASC ' +
        'LIMIT ? OFFSET ?;',
      categoryId,
      limit,
      offset
    );

    console.log(
      'CHAÎNES LIVE LUES DEPUIS SQLITE :',
      result.length,
      '| CATEGORY :',
      categoryId,
      '| OFFSET :',
      offset,
      '| LIMIT :',
      limit
    );

    return result;
  }

  /*
  TOUTES LES CATÉGORIES
  */

  const result = await db.getAllAsync<Channel>(
    'SELECT ' +
      'stream_id, ' +
      'num, ' +
      'name, ' +
      'stream_type, ' +
      'epg_channel_id, ' +
      'added, ' +
      'is_adult, ' +
      'category_id, ' +
      'custom_sid, ' +
      'tv_archive, ' +
      'direct_source, ' +
      'tv_archive_duration ' +
      'FROM live_channels ' +
      'ORDER BY name COLLATE NOCASE ASC ' +
      'LIMIT ? OFFSET ?;',
    limit,
    offset
  );

  console.log(
    'CHAÎNES LIVE LUES DEPUIS SQLITE :',
    result.length,
    '| OFFSET :',
    offset,
    '| LIMIT :',
    limit
  );

  return result;
}


/*
NOMBRE DE CHAÎNES

*/

export async function getLiveChannelsCount(
  categoryId?: string
): Promise<number> {
  const db = await initDatabase();

  if (categoryId) {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count ' +
        'FROM live_channels ' +
        'WHERE category_id = ?;',
      categoryId
    );

    return Number(result?.count ?? 0);
  }

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count ' +
      'FROM live_channels;'
  );

  return Number(result?.count ?? 0);
}

/*
LOGO EN CACHE

*/

export function getCachedLiveIcon(
streamId: number
): string | null {
return (
liveIconCache.get(
streamId
) ?? null
);
}

/**

Recherche les chaînes Live TV directement dans SQLite.


La recherche fonctionne sur l'ensemble de la base,
pas uniquement sur les chaînes déjà affichées.
*/
export async function searchLiveChannelsFromDatabase(
  search: string,
  categoryId?: string,
  limit = 100,
  offset = 0
): Promise<Channel[]> {
  const db = await initDatabase();

  const searchTerm = '%' + search.trim() + '%';

  if (categoryId && categoryId !== 'all') {
    return await db.getAllAsync<Channel>(
      'SELECT ' +
        'stream_id, ' +
        'num, ' +
        'name, ' +
        'stream_type, ' +
        'epg_channel_id, ' +
        'added, ' +
        'is_adult, ' +
        'category_id, ' +
        'custom_sid, ' +
        'tv_archive, ' +
        'direct_source, ' +
        'tv_archive_duration ' +
        'FROM live_channels ' +
        'WHERE category_id = ? ' +
        'AND name LIKE ? COLLATE NOCASE ' +
        'ORDER BY name COLLATE NOCASE ASC ' +
        'LIMIT ? OFFSET ?;',
      categoryId,
      searchTerm,
      limit,
      offset
    );
  }

  return await db.getAllAsync<Channel>(
    'SELECT ' +
      'stream_id, ' +
      'num, ' +
      'name, ' +
      'stream_type, ' +
      'epg_channel_id, ' +
      'added, ' +
      'is_adult, ' +
      'category_id, ' +
      'custom_sid, ' +
      'tv_archive, ' +
      'direct_source, ' +
      'tv_archive_duration ' +
      'FROM live_channels ' +
      'WHERE name LIKE ? COLLATE NOCASE ' +
      'ORDER BY name COLLATE NOCASE ASC ' +
      'LIMIT ? OFFSET ?;',
    searchTerm,
    limit,
    offset
  );
}

/**

Compte les résultats de recherche Live TV.
*/
export async function getSearchLiveChannelsCount(
search: string,
categoryId?: string,
): Promise<number> {
const db = await initDatabase();

const searchTerm = '%' + search.trim() + '%';
let result: any;

if (categoryId && categoryId !== 'all') {
result = await db.getFirstAsync<{ count: number }>(
'SELECT COUNT() AS count ' +
'FROM live_channels ' +
'WHERE category_id = ? ' +
'AND name LIKE ? COLLATE NOCASE;',
[
categoryId,
searchTerm,
],
);
} else {
result = await db.getFirstAsync<{ count: number }>(
'SELECT COUNT() AS count ' +
'FROM live_channels ' +
'WHERE name LIKE ? COLLATE NOCASE;',
[
searchTerm,
],
);
}

return Number(
result?.count ?? 0
);
}