import { initDatabase } from './database';

import {
  XtreamClient,
  XtreamLiveCategory,
  XtreamLiveChannel,
  XtreamConfig,
} from '../api/xtreamClient';

import { Channel } from '../types/live';
import { getUserAccess } from '../api/accessApi';

/*
============================================================
CACHE DES LOGOS
============================================================
*/

const liveIconCache = new Map<number, string>();

/*
============================================================
TYPE RÉSULTAT SYNCHRONISATION
============================================================
*/

type LiveSyncResult = {
  synchronized: boolean;
  serverCount: number;
  sqliteCount: number;
  categoriesCount: number;
  channelsCount: number;
};

/*
============================================================
PROMESSE DE SYNCHRONISATION UNIQUE
============================================================
*/

let liveSyncPromise: Promise<LiveSyncResult> | null = null;

/*
============================================================
PROGRESSION
============================================================
*/

export type LiveSyncProgress = {
  phase: 'categories' | 'channels' | 'completed';
  current: number;
  total: number;
};

/*
============================================================
RÉCUPÉRATION DU CLIENT XTREAM
============================================================
*/

async function getLiveXtreamClient(): Promise<{
  client: XtreamClient;
  adultAccess: boolean;
}> {
  const access = await getUserAccess();

  if (!access.xtream) {
    throw new Error(
      'Aucune configuration Xtream disponible pour cet utilisateur.',
    );
  }

  const config: XtreamConfig = {
    server: access.xtream.server_url,
    username: access.xtream.username,
    password: access.xtream.password,
  };

  return {
    client: new XtreamClient(config),
    adultAccess: access.limits?.adult ?? false,
  };
}

/*
============================================================
DÉTECTION CATÉGORIE ADULTE
============================================================
*/

function isAdultCategory(
  category: XtreamLiveCategory,
): boolean {
  const normalizedName =
    category.category_name
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim() ?? '';

  return (
    normalizedName === 'adult' ||
    normalizedName === 'adulte' ||
    normalizedName.includes('adult')
  );
}

/*
============================================================
DÉTECTION CHAÎNE ADULTE
============================================================
*/

function isAdultChannel(
  channel: XtreamLiveChannel,
  adultCategoryIds: Set<string>,
): boolean {
  if (channel.is_adult) {
    return true;
  }

  if (
    channel.category_id &&
    adultCategoryIds.has(String(channel.category_id))
  ) {
    return true;
  }

  const normalizedName =
    channel.name
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim() ?? '';

  return (
    normalizedName.includes('adult') ||
    normalizedName.includes('xxx')
  );
}

/*
============================================================
SYNCHRONISATION DES CATÉGORIES LIVE
============================================================
*/

export async function syncLiveCategories(
  xtreamClient?: XtreamClient,
  adultAccess?: boolean,
): Promise<number> {
  const db = await initDatabase();

  let client = xtreamClient;
  let allowAdult = adultAccess;

  if (!client) {
    const liveAccess = await getLiveXtreamClient();

    client = liveAccess.client;
    allowAdult = liveAccess.adultAccess;
  }

  console.log(
    'RÉCUPÉRATION DES CATÉGORIES LIVE...',
  );

  const categories: XtreamLiveCategory[] =
    await client.getLiveCategories();

  console.log(
    'CATÉGORIES LIVE RÉCUPÉRÉES :',
    categories.length,
  );

  const accessibleCategories = allowAdult
    ? categories
    : categories.filter(
        (category) => !isAdultCategory(category),
      );

  console.log(
    'CATÉGORIES LIVE ACCESSIBLES :',
    accessibleCategories.length,
  );

  /*
  ============================================================
  IDENTIFIANTS SERVEUR
  ============================================================
  */

  const serverCategoryIds = new Set(
    accessibleCategories.map(
      (category) => String(category.category_id),
    ),
  );

  /*
  ============================================================
  UPSERT CATÉGORIES
  ============================================================
  */

  for (const category of accessibleCategories) {
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
      ],
    );
  }

  /*
  ============================================================
  SUPPRESSION DES CATÉGORIES DISPARUES
  ============================================================
  */

  const localCategories =
    await db.getAllAsync<{
      category_id: string;
    }>(
      'SELECT category_id FROM live_categories;',
    );

  let deletedCategories = 0;

  for (const category of localCategories) {
    if (
      !serverCategoryIds.has(
        String(category.category_id),
      )
    ) {
      await db.runAsync(
        'DELETE FROM live_categories WHERE category_id = ?;',
        category.category_id,
      );

      deletedCategories++;
    }
  }

  console.log(
    'CATÉGORIES LIVE UPSERT :',
    accessibleCategories.length,
  );

  console.log(
    'CATÉGORIES LIVE SUPPRIMÉES :',
    deletedCategories,
  );

  return accessibleCategories.length;
}

/*
============================================================
SYNCHRONISATION DES CHAÎNES LIVE
============================================================
*/

export async function syncLiveChannels(
  onProgress?: (
    current: number,
    total: number,
  ) => void,
  serverChannels?: XtreamLiveChannel[],
  xtreamClient?: XtreamClient,
  adultAccess?: boolean,
  adultCategoryIds?: Set<string>,
): Promise<number> {
  const db = await initDatabase();

  let client = xtreamClient;
  let allowAdult = adultAccess;

  if (!client) {
    const liveAccess = await getLiveXtreamClient();

    client = liveAccess.client;
    allowAdult = liveAccess.adultAccess;
  }

  console.log(
    'RÉCUPÉRATION DES CHAÎNES LIVE...',
  );

  const channels: XtreamLiveChannel[] =
    serverChannels ??
    (await client.getLiveStreams());

  console.log(
    'CHAÎNES LIVE RÉCUPÉRÉES :',
    channels.length,
  );

  /*
  ============================================================
  RÉCUPÉRATION DES CATÉGORIES ADULTES
  ============================================================
  */

  let resolvedAdultCategoryIds =
    adultCategoryIds;

  if (!resolvedAdultCategoryIds) {
    const categories =
      await client.getLiveCategories();

    resolvedAdultCategoryIds =
      new Set<string>();

    for (const category of categories) {
      if (isAdultCategory(category)) {
        resolvedAdultCategoryIds.add(
          String(category.category_id),
        );
      }
    }
  }

  /*
  ============================================================
  FILTRAGE DU CATALOGUE
  ============================================================
  */

  const accessibleChannels =
    allowAdult
      ? channels
      : channels.filter(
          (channel) =>
            !isAdultChannel(
              channel,
              resolvedAdultCategoryIds!,
            ),
        );

  const total =
    accessibleChannels.length;

  const BATCH_SIZE = 500;

  let current = 0;

  /*
  ============================================================
  IDENTIFIANTS SERVEUR
  ============================================================
  */

  const serverStreamIds =
    new Set<number>();

  for (const channel of accessibleChannels) {
    serverStreamIds.add(
      Number(channel.stream_id),
    );
  }

  /*
  ============================================================
  UPSERT PAR LOT
  ============================================================
  */

  for (
    let start = 0;
    start < total;
    start += BATCH_SIZE
  ) {
    const batch =
      accessibleChannels.slice(
        start,
        start + BATCH_SIZE,
      );

    await db.withTransactionAsync(
      async () => {
        for (const channel of batch) {
          /*
          ======================================================
          CACHE DU LOGO
          ======================================================
          */

          if (channel.stream_icon) {
            liveIconCache.set(
              Number(channel.stream_id),
              channel.stream_icon,
            );
          }

          /*
          ======================================================
          UPSERT DE LA CHAÎNE
          ======================================================
          */

          await db.runAsync(
            'INSERT INTO live_channels ' +
              '(' +
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
              'tv_archive_duration' +
              ') ' +
              'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
              'ON CONFLICT(stream_id) DO UPDATE SET ' +
              'num = excluded.num, ' +
              'name = excluded.name, ' +
              'stream_type = excluded.stream_type, ' +
              'epg_channel_id = excluded.epg_channel_id, ' +
              'added = excluded.added, ' +
              'is_adult = excluded.is_adult, ' +
              'category_id = excluded.category_id, ' +
              'custom_sid = excluded.custom_sid, ' +
              'tv_archive = excluded.tv_archive, ' +
              'direct_source = excluded.direct_source, ' +
              'tv_archive_duration = excluded.tv_archive_duration;',
            [
              channel.stream_id,
              channel.num ?? null,
              channel.name,
              channel.stream_type ?? null,
              channel.epg_channel_id ?? null,
              channel.added ?? null,
              channel.is_adult ?? 0,
              channel.category_id ?? null,
              channel.custom_sid ?? null,
              channel.tv_archive ?? 0,
              channel.direct_source ?? null,
              channel.tv_archive_duration ?? 0,
            ],
          );
        }
      },
    );

    current += batch.length;

    onProgress?.(
      current,
      total,
    );

    console.log(
      'CHAÎNES LIVE UPSERT :',
      current,
      '/',
      total,
    );
  }

  /*
  ============================================================
  SUPPRESSION DES CHAÎNES DISPARUES
  ============================================================
  */

  const localChannels =
    await db.getAllAsync<{
      stream_id: number;
    }>(
      'SELECT stream_id FROM live_channels;',
    );

  let deletedChannels = 0;

  for (const channel of localChannels) {
    if (
      !serverStreamIds.has(
        Number(channel.stream_id),
      )
    ) {
      await db.runAsync(
        'DELETE FROM live_channels WHERE stream_id = ?;',
        channel.stream_id,
      );

      liveIconCache.delete(
        Number(channel.stream_id),
      );

      deletedChannels++;
    }
  }

  console.log(
    'CHAÎNES LIVE SUPPRIMÉES :',
    deletedChannels,
  );

  console.log(
    'UPSERT CHAÎNES LIVE TERMINÉ :',
    current,
  );

  return current;
}

/*
============================================================
NOMBRE DE CATÉGORIES
============================================================
*/

export async function getLiveCategoriesCount(): Promise<number> {
  const db = await initDatabase();

  const result =
    await db.getFirstAsync<{
      count: number;
    }>(
      'SELECT COUNT(*) AS count FROM live_categories;',
    );

  return Number(
    result?.count ?? 0,
  );
}

/*
============================================================
SYNCHRONISATION INTELLIGENTE LIVE TV
============================================================
*/

export async function syncLiveTVIfNeeded(
  onProgress?: (
    progress: LiveSyncProgress,
  ) => void,
): Promise<LiveSyncResult> {
  if (liveSyncPromise) {
    console.log(
      'SYNCHRONISATION LIVE TV DÉJÀ EN COURS — ATTENTE...',
    );

    return liveSyncPromise;
  }

  liveSyncPromise = (async () => {
    const db = await initDatabase();

    console.log('================================');
    console.log('VÉRIFICATION LIVE TV');
    console.log('================================');

    /*
    ============================================================
    RÉCUPÉRATION ACCÈS UTILISATEUR
    ============================================================
    */

    const liveAccess =
      await getLiveXtreamClient();

    const client =
      liveAccess.client;

    const adultAccess =
      liveAccess.adultAccess;

    /*
    ============================================================
    RÉCUPÉRATION SERVEUR
    ============================================================
    */

    console.log(
      'RÉCUPÉRATION DES CHAÎNES SERVEUR...',
    );

    const serverChannels =
      await client.getLiveStreams();

    /*
    ============================================================
    RÉCUPÉRATION CATÉGORIES
    ============================================================
    */

    const serverCategories =
      await client.getLiveCategories();

    const adultCategoryIds =
      new Set<string>();

    for (
      const category of serverCategories
    ) {
      if (isAdultCategory(category)) {
        adultCategoryIds.add(
          String(category.category_id),
        );
      }
    }

    /*
    ============================================================
    FILTRAGE SELON ABONNEMENT
    ============================================================
    */

    const accessibleChannels =
      adultAccess
        ? serverChannels
        : serverChannels.filter(
            (channel) =>
              !isAdultChannel(
                channel,
                adultCategoryIds,
              ),
          );

    const serverCount =
      accessibleChannels.length;

    /*
    ============================================================
    NOMBRE SQLITE
    ============================================================
    */

    const result =
      await db.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count FROM live_channels;',
      );

    const sqliteCount =
      Number(result?.count ?? 0);

    console.log(
      'NOMBRE CHAÎNES SERVEUR ACCESSIBLES :',
      serverCount,
    );

    console.log(
      'NOMBRE CHAÎNES SQLITE :',
      sqliteCount,
    );

    /*
    ============================================================
    IDENTIFIANTS SERVEUR / SQLITE
    ============================================================
    */

    const serverIds =
      new Set<number>();

    for (
      const channel of accessibleChannels
    ) {
      serverIds.add(
        Number(channel.stream_id),
      );
    }

    const localChannels =
      await db.getAllAsync<{
        stream_id: number;
      }>(
        'SELECT stream_id FROM live_channels;',
      );

    const localIds =
      new Set<number>();

    for (
      const channel of localChannels
    ) {
      localIds.add(
        Number(channel.stream_id),
      );
    }

    /*
    ============================================================
    COMPARAISON
    ============================================================
    */

    let hasChanges =
      serverIds.size !== localIds.size;

    if (!hasChanges) {
      for (const streamId of serverIds) {
        if (!localIds.has(streamId)) {
          hasChanges = true;
          break;
        }
      }
    }

    /*
    ============================================================
    AUCUN CHANGEMENT
    ============================================================
    */

    if (
      !hasChanges &&
      sqliteCount > 0
    ) {
      console.log('================================');
      console.log(
        'CATALOGUE LIVE TV DÉJÀ À JOUR',
      );
      console.log(
        'AUCUN UPSERT NÉCESSAIRE',
      );
      console.log(
        'ACTUALISATION DU CACHE DES LOGOS',
      );
      console.log('================================');

      let iconsLoaded = 0;

      for (
        const channel of accessibleChannels
      ) {
        if (channel.stream_icon) {
          liveIconCache.set(
            Number(channel.stream_id),
            channel.stream_icon,
          );

          iconsLoaded++;
        }
      }

      console.log(
        'LOGOS MIS EN CACHE :',
        iconsLoaded,
      );

      /*
      ============================================================
      VÉRIFICATION DES CATÉGORIES
      ============================================================
      */

      const localCategoryResult =
        await db.getFirstAsync<{
          count: number;
        }>(
          'SELECT COUNT(*) AS count FROM live_categories;',
        );

      const localCategoriesCount =
        Number(
          localCategoryResult?.count ?? 0,
        );

      const accessibleCategories =
        adultAccess
          ? serverCategories
          : serverCategories.filter(
              (category) =>
                !isAdultCategory(category),
            );

      if (
        localCategoriesCount !==
        accessibleCategories.length
      ) {
        console.log(
          'CATÉGORIES MODIFIÉES : SYNCHRONISATION...',
        );

        const categoriesCount =
          await syncLiveCategories(
            client,
            adultAccess,
          );

        return {
          synchronized: true,
          serverCount,
          sqliteCount,
          categoriesCount,
          channelsCount: sqliteCount,
        };
      }

      return {
        synchronized: false,
        serverCount,
        sqliteCount,
        categoriesCount:
          localCategoriesCount,
        channelsCount:
          sqliteCount,
      };
    }

    /*
    ============================================================
    MODIFICATION DÉTECTÉE
    ============================================================
    */

    console.log('================================');
    console.log(
      'MODIFICATION DU CATALOGUE DÉTECTÉE',
    );
    console.log(
      'SYNCHRONISATION NÉCESSAIRE',
    );
    console.log('================================');

    /*
    ============================================================
    CATÉGORIES
    ============================================================
    */

    const categoriesCount =
      await syncLiveCategories(
        client,
        adultAccess,
      );

    onProgress?.({
      phase: 'categories',
      current: categoriesCount,
      total: categoriesCount,
    });

    /*
    ============================================================
    CHAÎNES
    ============================================================
    */

    const channelsCount =
      await syncLiveChannels(
        (
          current,
          total,
        ) => {
          onProgress?.({
            phase: 'channels',
            current,
            total,
          });
        },
        serverChannels,
        client,
        adultAccess,
        adultCategoryIds,
      );

    /*
    ============================================================
    TERMINÉ
    ============================================================
    */

    onProgress?.({
      phase: 'completed',
      current: channelsCount,
      total: channelsCount,
    });

    console.log('================================');
    console.log(
      'LIVE TV SYNCHRONISÉ',
    );
    console.log(
      'CATÉGORIES :',
      categoriesCount,
    );
    console.log(
      'CHAÎNES :',
      channelsCount,
    );
    console.log('================================');

    return {
      synchronized: true,
      serverCount,
      sqliteCount,
      categoriesCount,
      channelsCount,
    };
  })();

  try {
    return await liveSyncPromise;
  } finally {
    liveSyncPromise = null;
  }
}

/*
============================================================
SYNCHRONISATION COMPLÈTE LIVE TV
============================================================
*/

export async function syncLiveTV(
  onProgress?: (
    progress: LiveSyncProgress,
  ) => void,
) {
  console.log('================================');
  console.log(
    'DÉBUT SYNCHRONISATION LIVE TV',
  );
  console.log('================================');

  const liveAccess =
    await getLiveXtreamClient();

  const client =
    liveAccess.client;

  const adultAccess =
    liveAccess.adultAccess;

  /*
  ============================================================
  CATÉGORIES
  ============================================================
  */

  const categoriesCount =
    await syncLiveCategories(
      client,
      adultAccess,
    );

  onProgress?.({
    phase: 'categories',
    current: categoriesCount,
    total: categoriesCount,
  });

  /*
  ============================================================
  CHAÎNES
  ============================================================
  */

  const channels =
    await client.getLiveStreams();

  const serverCategories =
    await client.getLiveCategories();

  const adultCategoryIds =
    new Set<string>();

  for (
    const category of serverCategories
  ) {
    if (isAdultCategory(category)) {
      adultCategoryIds.add(
        String(category.category_id),
      );
    }
  }

  const channelsCount =
    await syncLiveChannels(
      (
        current,
        total,
      ) => {
        onProgress?.({
          phase: 'channels',
          current,
          total,
        });
      },
      channels,
      client,
      adultAccess,
      adultCategoryIds,
    );

  /*
  ============================================================
  TERMINÉ
  ============================================================
  */

  onProgress?.({
    phase: 'completed',
    current: channelsCount,
    total: channelsCount,
  });

  console.log('================================');
  console.log(
    'LIVE TV SYNCHRONISÉ',
  );
  console.log(
    'CATÉGORIES :',
    categoriesCount,
  );
  console.log(
    'CHAÎNES :',
    channelsCount,
  );
  console.log('================================');

  return {
    categoriesCount,
    channelsCount,
  };
}

/*
============================================================
CATÉGORIES DEPUIS SQLITE
============================================================
*/

export async function getLiveCategoriesFromDatabase(): Promise<
  {
    category_id: string;
    category_name: string;
    parent_id: number;
  }[]
> {
  const db = await initDatabase();

  const result =
    await db.getAllAsync<{
      category_id: string;
      category_name: string;
      parent_id: number;
    }>(
      'SELECT ' +
        'category_id, ' +
        'category_name, ' +
        'parent_id ' +
        'FROM live_categories ' +
        'ORDER BY category_name ASC;',
    );

  console.log(
    'CATÉGORIES LIVE LUES DEPUIS SQLITE :',
    result.length,
  );

  return result;
}

/*
============================================================
CHAÎNES DEPUIS SQLITE
============================================================
*/

export async function getLiveChannelsFromDatabase(
  categoryId?: string,
  limit = 100,
  offset = 0,
): Promise<Channel[]> {
  const db = await initDatabase();

  /*
  ============================================================
  UNE CATÉGORIE
  ============================================================
  */

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    const result =
      await db.getAllAsync<Channel>(
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
        offset,
      );

    console.log(
      'CHAÎNES LIVE LUES DEPUIS SQLITE :',
      result.length,
      '| CATEGORY :',
      categoryId,
      '| OFFSET :',
      offset,
      '| LIMIT :',
      limit,
    );

    return result;
  }

  /*
  ============================================================
  TOUTES LES CATÉGORIES
  ============================================================
  */

  const result =
    await db.getAllAsync<Channel>(
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
      offset,
    );

  console.log(
    'CHAÎNES LIVE LUES DEPUIS SQLITE :',
    result.length,
    '| OFFSET :',
    offset,
    '| LIMIT :',
    limit,
  );

  return result;
}

/*
============================================================
NOMBRE DE CHAÎNES
============================================================
*/

export async function getLiveChannelsCount(
  categoryId?: string,
): Promise<number> {
  const db = await initDatabase();

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    const result =
      await db.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count ' +
          'FROM live_channels ' +
          'WHERE category_id = ?;',
        categoryId,
      );

    return Number(
      result?.count ?? 0,
    );
  }

  const result =
    await db.getFirstAsync<{
      count: number;
    }>(
      'SELECT COUNT(*) AS count ' +
        'FROM live_channels;',
    );

  return Number(
    result?.count ?? 0,
  );
}

/*
============================================================
LOGO EN CACHE
============================================================
*/

export function getCachedLiveIcon(
  streamId: number,
): string | null {
  return (
    liveIconCache.get(
      streamId,
    ) ?? null
  );
}

/*
============================================================
RECHERCHE LIVE TV SQLITE
============================================================
*/

export async function searchLiveChannelsFromDatabase(
  search: string,
  categoryId?: string,
  limit = 100,
  offset = 0,
): Promise<Channel[]> {
  const db = await initDatabase();

  const searchTerm =
    '%' +
    search.trim() +
    '%';

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
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
      offset,
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
    offset,
  );
}

/*
============================================================
NOMBRE DE RÉSULTATS DE RECHERCHE
============================================================
*/

export async function getSearchLiveChannelsCount(
  search: string,
  categoryId?: string,
): Promise<number> {
  const db = await initDatabase();

  const searchTerm =
    '%' +
    search.trim() +
    '%';

  let result: {
    count: number;
  } | null;

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    result =
      await db.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count ' +
          'FROM live_channels ' +
          'WHERE category_id = ? ' +
          'AND name LIKE ? COLLATE NOCASE;',
        [
          categoryId,
          searchTerm,
        ],
      );
  } else {
    result =
      await db.getFirstAsync<{
        count: number;
      }>(
        'SELECT COUNT(*) AS count ' +
          'FROM live_channels ' +
          'WHERE name LIKE ? COLLATE NOCASE;',
        [searchTerm],
      );
  }

  return Number(
    result?.count ?? 0,
  );
}