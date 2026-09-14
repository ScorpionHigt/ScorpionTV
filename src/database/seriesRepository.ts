import { initDatabase } from './database';

import {
  XtreamClient,
  XtreamSeries,
  XtreamSeriesCategory,
  XtreamSeriesInfo,
} from '../api/xtreamClient';

import { xtreamConfig } from '../api/config';

const client = new XtreamClient(xtreamConfig);

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
CATÉGORIES
============================================================
*/

export async function syncSeriesCategories(): Promise<number> {
  const db = await initDatabase();

  console.log('RÉCUPÉRATION DES CATÉGORIES SERIES...');

  const categories: XtreamSeriesCategory[] =
    await client.getSeriesCategories();

  console.log(
    'CATÉGORIES SERIES RÉCUPÉRÉES :',
    categories.length
  );

  await db.withTransactionAsync(async () => {
    for (const category of categories) {
      await db.runAsync(
        'INSERT INTO series_categories ' +
          '(category_id, category_name, parent_id) ' +
          'VALUES (?, ?, ?) ' +
          'ON CONFLICT(category_id) DO UPDATE SET ' +
          'category_name = excluded.category_name, ' +
          'parent_id = excluded.parent_id;',
        category.category_id,
        category.category_name,
        category.parent_id ?? 0
      );
    }
  });

  return categories.length;
}

/*
============================================================
SÉRIES
============================================================
*/
export async function syncSeries(): Promise<number> {
  const db = await initDatabase();

  console.log('RÉCUPÉRATION DES SERIES...');

  const seriesList: XtreamSeries[] =
    await client.getSeries();

  console.log(
    'SERIES RÉCUPÉRÉES :',
    seriesList.length
  );

  let inserted = 0;

  await db.withTransactionAsync(async () => {
    for (const series of seriesList) {
      const backdropPath =
        Array.isArray(series.backdrop_path)
          ? JSON.stringify(series.backdrop_path)
          : null;

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
        )
        ON CONFLICT(series_id)
        DO UPDATE SET
          name = excluded.name,
          plot = excluded.plot,
          cast = excluded.cast,
          director = excluded.director,
          genre = excluded.genre,
          release_date = excluded.release_date,
          rating = excluded.rating,
          rating_5based = excluded.rating_5based,
          backdrop_path = excluded.backdrop_path,
          youtube_trailer = excluded.youtube_trailer,
          episode_run_time = excluded.episode_run_time,
          category_id = excluded.category_id
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

      inserted++;
    }
  });

  console.log(
    'SERIES SYNCHRONISÉES :',
    inserted
  );

  return inserted;
}

/*
============================================================
SYNCHRONISATION COMPLÈTE
============================================================
*/

export async function syncSeriesTV() {
  const categoriesCount =
    await syncSeriesCategories();

  const seriesCount =
    await syncSeries();

  return {
    categoriesCount,
    seriesCount,
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
    'SELECT ' +
      'category_id, ' +
      'category_name, ' +
      'parent_id ' +
      'FROM series_categories ' +
      'ORDER BY category_name ASC;'
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

  if (categoryId && categoryId !== 'all') {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count ' +
        'FROM series ' +
        'WHERE category_id = ?;',
      categoryId
    );

    return Number(result?.count ?? 0);
  }

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM series;'
  );

  return Number(result?.count ?? 0);
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

  if (categoryId && categoryId !== 'all') {
    console.log('SERIES SQL : requête avec catégorie');

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

  console.log('SERIES SQL : requête toutes les séries');

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

  const searchTerm = `%${search.trim()}%`;

  if (categoryId && categoryId !== 'all') {
    return await db.getAllAsync<Series>(
      'SELECT ' +
        'series_id, ' +
        'name, ' +
        'plot, ' +
        'cast, ' +
        'director, ' +
        'genre, ' +
        'release_date, ' +
        'rating, ' +
        'rating_5based, ' +
        'backdrop_path, ' +
        'youtube_trailer, ' +
        'episode_run_time, ' +
        'category_id ' +
        'FROM series ' +
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

  return await db.getAllAsync<Series>(
    'SELECT ' +
      'series_id, ' +
      'name, ' +
      'plot, ' +
      'cast, ' +
      'director, ' +
      'genre, ' +
      'release_date, ' +
      'rating, ' +
      'rating_5based, ' +
      'backdrop_path, ' +
      'youtube_trailer, ' +
      'episode_run_time, ' +
      'category_id ' +
      'FROM series ' +
      'WHERE name LIKE ? COLLATE NOCASE ' +
      'ORDER BY name COLLATE NOCASE ASC ' +
      'LIMIT ? OFFSET ?;',
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

  const searchTerm = `%${search.trim()}%`;

  if (categoryId && categoryId !== 'all') {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count ' +
        'FROM series ' +
        'WHERE category_id = ? ' +
        'AND name LIKE ? COLLATE NOCASE;',
      categoryId,
      searchTerm
    );

    return Number(result?.count ?? 0);
  }

  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count ' +
      'FROM series ' +
      'WHERE name LIKE ? COLLATE NOCASE;',
    searchTerm
  );

  return Number(result?.count ?? 0);
}

/*
============================================================
INFORMATIONS DÉTAILLÉES
============================================================
*/

export async function getSeriesInfo(
  seriesId: number
): Promise<XtreamSeriesInfo> {
  return await client.getSeriesInfo(String(seriesId));
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
      'DELETE FROM series_episodes WHERE series_id = ?;',
      seriesId
    );

    const episodes = info.episodes ?? {};

    for (const seasonKey of Object.keys(episodes)) {
      const seasonEpisodes = episodes[seasonKey] ?? [];

      for (const episode of seasonEpisodes) {
        const episodeId = Number(episode.id);

        if (!Number.isFinite(episodeId)) {
          continue;
        }

        await db.runAsync(
          'INSERT OR REPLACE INTO series_episodes ' +
            '(' +
            'episode_id, ' +
            'series_id, ' +
            'season, ' +
            'episode, ' +
            'title, ' +
            'container_extension, ' +
            'plot, ' +
            'rating, ' +
            'rating_5based, ' +
            'duration, ' +
            'duration_seconds, ' +
            'direct_source, ' +
            'added, ' +
            'custom_sid, ' +
            'episode_num' +
            ') ' +
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
          episodeId,
          seriesId,
          episode.season ?? Number(seasonKey) ?? null,
          episode.episode_num ?? null,
          episode.title ?? null,
          episode.container_extension ?? null,
          episode.info?.plot ?? null,
          episode.info?.rating ?? null,
          episode.info?.rating_5based ?? null,
          episode.info?.duration ?? null,
          episode.info?.duration_secs ?? null,
          episode.direct_source ?? null,
          episode.added ?? null,
          episode.custom_sid ?? null,
          episode.episode_num ?? null
        );

        inserted++;
      }
    }
  });

  return inserted;
}