import { initDatabase } from './database';

import {
  XtreamClient,
  XtreamSeries,
  XtreamSeriesCategory,
  XtreamSeriesInfo,
} from '../api/xtreamClient';

import { getUserAccess } from '../api/accessApi';

/*
============================================================
TYPES SQLITE
============================================================
*/

export type Series = {
  series_id: number;
  name: string;
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null;
  release_date: string | null;
  rating: string | null;
  rating_5based: number | null;
  backdrop_path: string | null;
  youtube_trailer: string | null;
  episode_run_time: number | null;
  category_id: string | null;
};

export type SeriesCategory = {
  category_id: string;
  category_name: string;
  parent_id: number | null;
};

export type SeriesEpisode = {
  episode_id: number;
  series_id: number;
  season: number | null;
  episode: number | null;
  title: string | null;
  container_extension: string | null;
  plot: string | null;
  rating: string | null;
  rating_5based: number | null;
  duration: string | null;
  duration_seconds: number | null;
  direct_source: string | null;
  added: string | null;
  custom_sid: string | null;
  episode_num: number | null;
};

/*
============================================================
TYPES SYNCHRONISATION
============================================================
*/

export type SeriesSyncProgress = {
  current: number;
  total: number;

  added: number;
  updated: number;
  deleted: number;
  unchanged: number;

  phase:
    | 'checking'
    | 'syncing'
    | 'deleting'
    | 'done';
};

export type SeriesSyncResult = {
  total: number;
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  changed: boolean;
};

/*
============================================================
CONFIGURATION
============================================================
*/

const BATCH_SIZE = 500;

/*
============================================================
CLIENT XTREAM
============================================================
*/

async function getSeriesXtreamClient(): Promise<{
  client: XtreamClient;
  adultAccess: boolean;
}> {
  const access = await getUserAccess();

  if (!access.xtream) {
    throw new Error(
      'Aucune configuration Xtream disponible pour cet utilisateur.'
    );
  }

  return {
    client: new XtreamClient({
      server: access.xtream.server_url,
      username: access.xtream.username,
      password: access.xtream.password,
    }),

    adultAccess:
      access.limits?.adult ?? false,
  };
}

/*
============================================================
DÉTECTION CONTENU ADULTE
============================================================
*/

function isAdultName(
  value: string | null | undefined
): boolean {
  const normalized =
    value
      ?.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim() ?? '';

  return (
    normalized.includes('adult') ||
    normalized.includes('xxx') ||
    normalized.includes('porn') ||
    normalized.includes('porno')
  );
}

function isAdultSeriesCategory(
  category: XtreamSeriesCategory
): boolean {
  return isAdultName(
    category.category_name
  );
}

function isAdultSeries(
  series: XtreamSeries
): boolean {
  return isAdultName(series.name);
}

/*
============================================================
SIGNATURE D'UNE SÉRIE
============================================================
*/

type SeriesSignatureData = {
  name?: string | null;
  plot?: string | null;
  cast?: string | null;
  director?: string | null;
  genre?: string | null;
  releaseDate?: string | null;
  release_date?: string | null;
  rating?: string | null;
  rating_5based?: number | null;
  backdrop_path?:
    | string[]
    | string
    | null;
  youtube_trailer?: string | null;
  episode_run_time?: number | null;
  category_id?: string | null;
};

function getSeriesSignature(
  series: SeriesSignatureData
): string {
  const backdropPath =
    Array.isArray(series.backdrop_path)
      ? JSON.stringify(series.backdrop_path)
      : series.backdrop_path ?? null;

  return JSON.stringify([
    series.name ?? null,
    series.plot ?? null,
    series.cast ?? null,
    series.director ?? null,
    series.genre ?? null,
    series.releaseDate ??
      series.release_date ??
      null,
    series.rating ?? null,
    series.rating_5based ?? null,
    backdropPath,
    series.youtube_trailer ?? null,
    series.episode_run_time ?? null,
    series.category_id ?? null,
  ]);
}

/*
============================================================
CATÉGORIES
============================================================
*/

export async function syncSeriesCategories(
  client?: XtreamClient,
  adultAccess?: boolean
): Promise<number> {
  const db = await initDatabase();

  let xtreamClient = client;
  let allowAdult = adultAccess;

  if (!xtreamClient) {
    const access =
      await getSeriesXtreamClient();

    xtreamClient = access.client;
    allowAdult = access.adultAccess;
  }

  console.log(
    'RÉCUPÉRATION DES CATÉGORIES SERIES...'
  );

  const remoteCategories =
    await xtreamClient.getSeriesCategories();

  const categories =
    allowAdult
      ? remoteCategories
      : remoteCategories.filter(
          (category) =>
            !isAdultSeriesCategory(category)
        );

  console.log(
    'CATÉGORIES SERIES RÉCUPÉRÉES :',
    remoteCategories.length
  );

  console.log(
    'CATÉGORIES SERIES AUTORISÉES :',
    categories.length
  );

  const allowedCategoryIds =
    new Set(
      categories.map(
        (category) =>
          category.category_id
      )
    );

  let deleted = 0;

  await db.withTransactionAsync(async () => {
    /*
    ----------------------------------------------------------
    | UPSERT CATÉGORIES
    ----------------------------------------------------------
    */

    for (const category of categories) {
      await db.runAsync(
        `
        INSERT INTO series_categories (
          category_id,
          category_name,
          parent_id
        )
        VALUES (?, ?, ?)
        ON CONFLICT(category_id)
        DO UPDATE SET
          category_name = excluded.category_name,
          parent_id = excluded.parent_id;
        `,
        category.category_id,
        category.category_name,
        category.parent_id ?? 0
      );
    }

    /*
    ----------------------------------------------------------
    | SUPPRESSION CATÉGORIES DISPARUES / ADULTES
    ----------------------------------------------------------
    */

    const localCategories =
      await db.getAllAsync<{
        category_id: string;
      }>(
        `
        SELECT category_id
        FROM series_categories;
        `
      );

    for (const localCategory of localCategories) {
      if (
        !allowedCategoryIds.has(
          localCategory.category_id
        )
      ) {
        await db.runAsync(
          `
          DELETE FROM series_categories
          WHERE category_id = ?;
          `,
          localCategory.category_id
        );

        await db.runAsync(
          `
          DELETE FROM series
          WHERE category_id = ?;
          `,
          localCategory.category_id
        );

        deleted++;
      }
    }
  });

  console.log(
    'CATÉGORIES SERIES SUPPRIMÉES :',
    deleted
  );

  return categories.length;
}

/*
============================================================
SYNCHRONISATION DES SÉRIES
============================================================
*/

export async function syncSeries(
  onProgress?: (
    progress: SeriesSyncProgress
  ) => void
): Promise<SeriesSyncResult> {
  const db = await initDatabase();

  const {
    client,
    adultAccess,
  } = await getSeriesXtreamClient();

  console.log(
    'RÉCUPÉRATION DES SERIES...'
  );

  const remoteSeries =
    await client.getSeries();

  const seriesList =
    adultAccess
      ? remoteSeries
      : remoteSeries.filter(
          (series) =>
            !isAdultSeries(series)
        );

  console.log(
    'SERIES RÉCUPÉRÉES :',
    remoteSeries.length
  );

  console.log(
    'SERIES AUTORISÉES :',
    seriesList.length
  );

  /*
  ----------------------------------------------------------
  | RÉCUPÉRATION SQLITE
  ----------------------------------------------------------
  */

  const localSeries =
    await db.getAllAsync<Series>(
      `
      SELECT
        series_id,
        name,
        plot,
        cast,
        director,
        genre,
        release_date,
        rating,
        rating_5based,
        backdrop_path,
        youtube_trailer,
        episode_run_time,
        category_id
      FROM series;
      `
    );

  const localMap =
    new Map<number, Series>();

  for (const series of localSeries) {
    localMap.set(
      series.series_id,
      series
    );
  }

  const remoteMap =
    new Map<number, XtreamSeries>();

  for (const series of seriesList) {
    remoteMap.set(
      series.series_id,
      series
    );
  }

  const remoteIds =
    new Set(
      seriesList.map(
        (series) =>
          series.series_id
      )
    );

  const sameIds =
    localSeries.length ===
      seriesList.length &&
    localSeries.every(
      (series) =>
        remoteIds.has(
          series.series_id
        )
    );

  let added = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  /*
  ----------------------------------------------------------
  | PHASE : CHECKING
  ----------------------------------------------------------
  */

  onProgress?.({
    current: 0,
    total: seriesList.length,
    added,
    updated,
    deleted,
    unchanged,
    phase: 'checking',
  });

  /*
  ----------------------------------------------------------
  | VÉRIFICATION DES MODIFICATIONS
  ----------------------------------------------------------
  */

  if (sameIds) {
    console.log(
      'SERIES : mêmes series_id dans Xtream et SQLite.'
    );

    console.log(
      'SERIES : vérification des éventuelles modifications...'
    );

    let hasChanges = false;

    for (const series of seriesList) {
      const localSeriesItem =
        localMap.get(
          series.series_id
        );

      if (!localSeriesItem) {
        hasChanges = true;
        break;
      }

      const remoteSignature =
        getSeriesSignature(
          series
        );

      const localSignature =
        getSeriesSignature(
          localSeriesItem
        );

      if (
        remoteSignature !==
        localSignature
      ) {
        hasChanges = true;
        break;
      }
    }

    /*
    --------------------------------------------------------
    | AUCUN CHANGEMENT
    --------------------------------------------------------
    */

    if (!hasChanges) {
      unchanged =
        seriesList.length;

      console.log(
        'SERIES : contenu identique, aucune synchronisation nécessaire.'
      );

      onProgress?.({
        current: seriesList.length,
        total: seriesList.length,
        added,
        updated,
        deleted,
        unchanged,
        phase: 'done',
      });

      return {
        total: seriesList.length,
        added,
        updated,
        deleted,
        unchanged,
        changed: false,
      };
    }
  }

  /*
  ----------------------------------------------------------
  | PHASE : SYNCHRONISATION
  ----------------------------------------------------------
  */

  console.log(
    'SERIES : synchronisation nécessaire.'
  );

  onProgress?.({
    current: 0,
    total: seriesList.length,
    added,
    updated,
    deleted,
    unchanged,
    phase: 'syncing',
  });

  /*
  ----------------------------------------------------------
  | AJOUT / MODIFICATION
  ----------------------------------------------------------
  */

  for (
    let index = 0;
    index < seriesList.length;
    index++
  ) {
    const series =
      seriesList[index];

    const localSeriesItem =
      localMap.get(
        series.series_id
      );

    const backdropPath =
      Array.isArray(
        series.backdrop_path
      )
        ? JSON.stringify(
            series.backdrop_path
          )
        : null;

    /*
    --------------------------------------------------------
    | NOUVELLE SÉRIE
    --------------------------------------------------------
    */

    if (!localSeriesItem) {
      await db.runAsync(
        `
        INSERT INTO series (
          series_id,
          name,
          plot,
          cast,
          director,
          genre,
          release_date,
          rating,
          rating_5based,
          backdrop_path,
          youtube_trailer,
          episode_run_time,
          category_id
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        );
        `,
        series.series_id,
        series.name,
        series.plot ?? null,
        series.cast ?? null,
        series.director ?? null,
        series.genre ?? null,
        series.releaseDate ?? null,
        series.rating ?? null,
        series.rating_5based ?? null,
        backdropPath,
        series.youtube_trailer ?? null,
        series.episode_run_time ?? null,
        series.category_id ?? null
      );

      added++;
    } else {
      /*
      ------------------------------------------------------
      | SÉRIE EXISTANTE
      ------------------------------------------------------
      */

      const remoteSignature =
        getSeriesSignature(
          series
        );

      const localSignature =
        getSeriesSignature(
          localSeriesItem
        );

      /*
      ------------------------------------------------------
      | AUCUNE MODIFICATION
      ------------------------------------------------------
      */

      if (
        remoteSignature ===
        localSignature
      ) {
        unchanged++;
      } else {
        /*
        ----------------------------------------------------
        | SÉRIE MODIFIÉE
        ----------------------------------------------------
        */

        await db.runAsync(
          `
          UPDATE series
          SET
            name = ?,
            plot = ?,
            cast = ?,
            director = ?,
            genre = ?,
            release_date = ?,
            rating = ?,
            rating_5based = ?,
            backdrop_path = ?,
            youtube_trailer = ?,
            episode_run_time = ?,
            category_id = ?
          WHERE series_id = ?;
          `,
          series.name,
          series.plot ?? null,
          series.cast ?? null,
          series.director ?? null,
          series.genre ?? null,
          series.releaseDate ?? null,
          series.rating ?? null,
          series.rating_5based ?? null,
          backdropPath,
          series.youtube_trailer ?? null,
          series.episode_run_time ?? null,
          series.category_id ?? null,
          series.series_id
        );

        updated++;
      }
    }

    /*
    --------------------------------------------------------
    | PROGRESSION
    --------------------------------------------------------
    */

    if (
      (index + 1) % BATCH_SIZE === 0 ||
      index === seriesList.length - 1
    ) {
      onProgress?.({
        current: index + 1,
        total: seriesList.length,
        added,
        updated,
        deleted,
        unchanged,
        phase: 'syncing',
      });
    }
  }

  /*
  ----------------------------------------------------------
  | SUPPRESSION DES SÉRIES DISPARUES
  ----------------------------------------------------------
  */

  onProgress?.({
    current: seriesList.length,
    total: seriesList.length,
    added,
    updated,
    deleted,
    unchanged,
    phase: 'deleting',
  });

  for (const localSeriesItem of localSeries) {
    if (
      !remoteMap.has(
        localSeriesItem.series_id
      )
    ) {
      await db.runAsync(
        `
        DELETE FROM series
        WHERE series_id = ?;
        `,
        localSeriesItem.series_id
      );

      await db.runAsync(
        `
        DELETE FROM series_episodes
        WHERE series_id = ?;
        `,
        localSeriesItem.series_id
      );

      deleted++;
    }
  }

  const changed =
    added > 0 ||
    updated > 0 ||
    deleted > 0;

  console.log(
    'SERIES SYNCHRONISÉES :',
    seriesList.length
  );

  console.log(
    'SERIES AJOUTÉES :',
    added
  );

  console.log(
    'SERIES MODIFIÉES :',
    updated
  );

  console.log(
    'SERIES SUPPRIMÉES :',
    deleted
  );

  console.log(
    'SERIES INCHANGÉES :',
    unchanged
  );

  onProgress?.({
    current: seriesList.length,
    total: seriesList.length,
    added,
    updated,
    deleted,
    unchanged,
    phase: 'done',
  });

  return {
    total: seriesList.length,
    added,
    updated,
    deleted,
    unchanged,
    changed,
  };
}

/*
============================================================
SYNCHRONISATION COMPLÈTE
============================================================
*/

export async function syncSeriesTV(
  onProgress?: (
    progress: SeriesSyncProgress
  ) => void
) {
  const {
    client,
    adultAccess,
  } = await getSeriesXtreamClient();

  const categoriesCount =
    await syncSeriesCategories(
      client,
      adultAccess
    );

  const seriesResult =
    await syncSeries(
      onProgress
    );

  return {
    categoriesCount,
    seriesCount:
      seriesResult.total,
    added:
      seriesResult.added,
    updated:
      seriesResult.updated,
    deleted:
      seriesResult.deleted,
    unchanged:
      seriesResult.unchanged,
    changed:
      seriesResult.changed,
  };
}

/*
============================================================
CATÉGORIES SQLITE
============================================================
*/

export async function getSeriesCategoriesFromDatabase(): Promise<
  SeriesCategory[]
> {
  const db = await initDatabase();

  return await db.getAllAsync<SeriesCategory>(
    `
    SELECT
      category_id,
      category_name,
      parent_id
    FROM series_categories
    ORDER BY category_name ASC;
    `
  );
}

/*
============================================================
NOMBRE DE SÉRIES
============================================================
*/

export async function getSeriesCountFromDatabase(
  categoryId?: string
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
        `
        SELECT COUNT(*) AS count
        FROM series
        WHERE category_id = ?;
        `,
        categoryId
      );

    return Number(
      result?.count ?? 0
    );
  }

  const result =
    await db.getFirstAsync<{
      count: number;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM series;
      `
    );

  return Number(
    result?.count ?? 0
  );
}

/*
============================================================
SÉRIES SQLITE
============================================================
*/

export async function getSeriesFromDatabase(
  categoryId?: string,
  limit = 100,
  offset = 0
): Promise<Series[]> {
  const db = await initDatabase();

  console.log(
    'SERIES SQL : categoryId =',
    categoryId,
    '| limit =',
    limit,
    '| offset =',
    offset
  );

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    console.log(
      'SERIES SQL : requête avec catégorie'
    );

    return await db.getAllAsync<Series>(
      `
      SELECT
        series_id,
        name,
        plot,
        cast,
        director,
        genre,
        release_date,
        rating,
        rating_5based,
        backdrop_path,
        youtube_trailer,
        episode_run_time,
        category_id
      FROM series
      WHERE category_id = ?
      ORDER BY name COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
      `,
      categoryId,
      limit,
      offset
    );
  }

  console.log(
    'SERIES SQL : requête toutes les séries'
  );

  return await db.getAllAsync<Series>(
    `
    SELECT
      series_id,
      name,
      plot,
      cast,
      director,
      genre,
      release_date,
      rating,
      rating_5based,
      backdrop_path,
      youtube_trailer,
      episode_run_time,
      category_id
    FROM series
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
    `,
    limit,
    offset
  );
}

/*
============================================================
RECHERCHE
============================================================
*/

export async function searchSeriesFromDatabase(
  search: string,
  categoryId?: string,
  limit = 100,
  offset = 0
): Promise<Series[]> {
  const db = await initDatabase();

  const searchTerm =
    `%${search.trim()}%`;

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    return await db.getAllAsync<Series>(
      `
      SELECT
        series_id,
        name,
        plot,
        cast,
        director,
        genre,
        release_date,
        rating,
        rating_5based,
        backdrop_path,
        youtube_trailer,
        episode_run_time,
        category_id
      FROM series
      WHERE category_id = ?
        AND name LIKE ? COLLATE NOCASE
      ORDER BY name COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
      `,
      categoryId,
      searchTerm,
      limit,
      offset
    );
  }

  return await db.getAllAsync<Series>(
    `
    SELECT
      series_id,
      name,
      plot,
      cast,
      director,
      genre,
      release_date,
      rating,
      rating_5based,
      backdrop_path,
      youtube_trailer,
      episode_run_time,
      category_id
    FROM series
    WHERE name LIKE ? COLLATE NOCASE
    ORDER BY name COLLATE NOCASE ASC
    LIMIT ? OFFSET ?
    `,
    searchTerm,
    limit,
    offset
  );
}

/*
============================================================
COMPTEUR RECHERCHE
============================================================
*/

export async function getSearchSeriesCountFromDatabase(
  search: string,
  categoryId?: string
): Promise<number> {
  const db = await initDatabase();

  const searchTerm =
    `%${search.trim()}%`;

  if (
    categoryId &&
    categoryId !== 'all'
  ) {
    const result =
      await db.getFirstAsync<{
        count: number;
      }>(
        `
        SELECT COUNT(*) AS count
        FROM series
        WHERE category_id = ?
          AND name LIKE ? COLLATE NOCASE;
        `,
        categoryId,
        searchTerm
      );

    return Number(
      result?.count ?? 0
    );
  }

  const result =
    await db.getFirstAsync<{
      count: number;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM series
      WHERE name LIKE ? COLLATE NOCASE;
      `,
      searchTerm
    );

  return Number(
    result?.count ?? 0
  );
}

/*
============================================================
INFORMATIONS DÉTAILLÉES
============================================================
*/

export async function getSeriesInfo(
  seriesId: number
): Promise<XtreamSeriesInfo> {
  const {
    client,
  } = await getSeriesXtreamClient();

  return await client.getSeriesInfo(
    String(seriesId)
  );
}

/*
============================================================
ÉPISODES
============================================================
*/

export async function saveSeriesEpisodes(
  seriesId: number,
  info: XtreamSeriesInfo
): Promise<number> {
  const db = await initDatabase();

  let inserted = 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `
      DELETE FROM series_episodes
      WHERE series_id = ?;
      `,
      seriesId
    );

    const episodes =
      info.episodes ?? {};

    for (
      const seasonKey of Object.keys(
        episodes
      )
    ) {
      const seasonEpisodes =
        episodes[seasonKey] ?? [];

      for (
        const episode of seasonEpisodes
      ) {
        const episodeId =
          Number(episode.id);

        if (
          !Number.isFinite(
            episodeId
          )
        ) {
          continue;
        }

        await db.runAsync(
          `
          INSERT OR REPLACE INTO series_episodes (
            episode_id,
            series_id,
            season,
            episode,
            title,
            container_extension,
            plot,
            rating,
            rating_5based,
            duration,
            duration_seconds,
            direct_source,
            added,
            custom_sid,
            episode_num
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          );
          `,
          episodeId,
          seriesId,
          episode.season ??
            Number(seasonKey) ??
            null,
          episode.episode_num ??
            null,
          episode.title ??
            null,
          episode.container_extension ??
            null,
          episode.info?.plot ??
            null,
          episode.info?.rating ??
            null,
          episode.info?.rating_5based ??
            null,
          episode.info?.duration ??
            null,
          episode.info?.duration_secs ??
            null,
          episode.direct_source ??
            null,
          episode.added ??
            null,
          episode.custom_sid ??
            null,
          episode.episode_num ??
            null
        );

        inserted++;
      }
    }
  });

  return inserted;
}
