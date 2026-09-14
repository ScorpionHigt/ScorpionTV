import { initDatabase } from './database';
import { XtreamClient } from '../api/xtreamClient';
import { xtreamConfig } from '../api/config';

export type Movie = {
  stream_id: number;
  name: string;
  stream_icon: string | null;
  rating: string | null;
  rating_5based: number | null;
  container_extension: string | null;
  category_id: string | null;
};

/*
|--------------------------------------------------------------------------
| Types synchronisation
|--------------------------------------------------------------------------
*/

export type MovieSyncProgress = {
  current: number;
  total: number;

  added: number;
  updated: number;
  deleted: number;
  unchanged: number;

  phase: 'checking' | 'syncing' | 'deleting' | 'done';
};

export type MovieSyncResult = {
  total: number;
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  changed: boolean;
};

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const BATCH_SIZE = 500;

/*
|--------------------------------------------------------------------------
| CATÉGORIES
|--------------------------------------------------------------------------
*/

export async function syncCategories() {
  const db = await initDatabase();

  const client = new XtreamClient(xtreamConfig);

  const categories = await client.getVodCategories();

  console.log(
    'CATÉGORIES RÉCUPÉRÉES :',
    categories.length
  );

  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM categories;');

    for (const category of categories) {
      await db.runAsync(
        `
        INSERT INTO categories (
          category_id,
          category_name,
          icon,
          is_adult,
          parent_id,
          stream_count
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        category.category_id,
        category.category_name,
        category.icon ?? null,
        category.is_adult ?? 0,
        category.parent_id ?? 0,
        category.stream_count ?? 0
      );
    }
  });

  console.log(
    'SYNCHRONISATION CATÉGORIES TERMINÉE :',
    categories.length
  );

  return categories.length;
}

/*
|--------------------------------------------------------------------------
| SIGNATURE D'UN FILM
|--------------------------------------------------------------------------
|
| Permet de déterminer si un film existant a réellement changé.
|
*/

function getMovieSignature(movie: any): string {
  return JSON.stringify([
    movie.name ?? null,
    movie.stream_type ?? null,
    movie.stream_icon ?? null,
    movie.rating ?? null,
    movie.rating_5based ?? null,
    movie.added ?? null,
    movie.is_adult ?? null,
    movie.container_extension ?? null,
    movie.custom_sid ?? null,
    movie.direct_source ?? null,
    movie.category_id ?? null,
  ]);
}

/*
|--------------------------------------------------------------------------
| SYNCHRONISATION INTELLIGENTE DES FILMS
|--------------------------------------------------------------------------
*/

export async function syncMoviesWithProgress(
  onProgress?: (progress: MovieSyncProgress) => void
): Promise<MovieSyncResult> {
  const db = await initDatabase();

  const client = new XtreamClient(xtreamConfig);

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 1 : récupération Xtream
   * ---------------------------------------------------------------
   */

  console.log('FILMS : récupération depuis Xtream...');

  onProgress?.({
    current: 0,
    total: 0,
    added: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    phase: 'checking',
  });

  const movies = await client.getVodStreams();

  console.log(
    'FILMS RÉCUPÉRÉS DEPUIS XTREAM :',
    movies.length
  );

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 2 : récupération SQLite
   * ---------------------------------------------------------------
   */

  const localMovies = await db.getAllAsync<{
    stream_id: number;
    name: string | null;
    stream_type: string | null;
    stream_icon: string | null;
    rating: string | null;
    rating_5based: number | null;
    added: string | null;
    is_adult: number | null;
    container_extension: string | null;
    custom_sid: string | null;
    direct_source: string | null;
    category_id: string | null;
  }>(
    `
    SELECT
      stream_id,
      name,
      stream_type,
      stream_icon,
      rating,
      rating_5based,
      added,
      is_adult,
      container_extension,
      custom_sid,
      direct_source,
      category_id
    FROM movies
    `
  );

  console.log(
    'FILMS PRÉSENTS DANS SQLITE :',
    localMovies.length
  );

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 3 : indexation
   * ---------------------------------------------------------------
   */

  const localMap = new Map<
    number,
    (typeof localMovies)[number]
  >();

  for (const movie of localMovies) {
    localMap.set(movie.stream_id, movie);
  }

  const remoteMap = new Map<
    number,
    (typeof movies)[number]
  >();

  for (const movie of movies) {
    remoteMap.set(movie.stream_id, movie);
  }

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 4 : comparaison des IDs
   * ---------------------------------------------------------------
   */

  const localIds = new Set(localMap.keys());
  const remoteIds = new Set(remoteMap.keys());

  let sameIds = localIds.size === remoteIds.size;

  if (sameIds) {
    for (const id of remoteIds) {
      if (!localIds.has(id)) {
        sameIds = false;
        break;
      }
    }
  }

  /*
   * ---------------------------------------------------------------
   * COMPTEURS
   * ---------------------------------------------------------------
   */

  let added = 0;
  let updated = 0;
  let deleted = 0;
  let unchanged = 0;

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 5 : si les IDs sont identiques,
   * vérification des changements
   * ---------------------------------------------------------------
   */

  if (sameIds) {
    console.log(
      'FILMS : mêmes stream_id dans Xtream et SQLite.'
    );

    console.log(
      'FILMS : vérification des éventuelles modifications...'
    );

    let hasChanges = false;

    for (const movie of movies) {
      const localMovie = localMap.get(movie.stream_id);

      if (!localMovie) {
        hasChanges = true;
        break;
      }

      const remoteSignature = getMovieSignature(movie);
      const localSignature = getMovieSignature(localMovie);

      if (remoteSignature !== localSignature) {
        hasChanges = true;
        break;
      }
    }

    /*
     * -------------------------------------------------------------
     * AUCUN CHANGEMENT
     * -------------------------------------------------------------
     */

    if (!hasChanges) {
      unchanged = movies.length;

      console.log(
        'FILMS : contenu identique, aucune synchronisation nécessaire.'
      );

      console.log(
        'Total :',
        movies.length
      );

      console.log(
        'Ajoutés : 0'
      );

      console.log(
        'Modifiés : 0'
      );

      console.log(
        'Supprimés : 0'
      );

      console.log(
        'Inchangés :',
        unchanged
      );

      onProgress?.({
        current: movies.length,
        total: movies.length,
        added: 0,
        updated: 0,
        deleted: 0,
        unchanged,
        phase: 'done',
      });

      return {
        total: movies.length,
        added: 0,
        updated: 0,
        deleted: 0,
        unchanged,
        changed: false,
      };
    }

    console.log(
      'FILMS : des modifications ont été détectées.'
    );
  }

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 6 : synchronisation par lots
   * ---------------------------------------------------------------
   */

  const total = movies.length;

  console.log(
    'FILMS : synchronisation par lots de',
    BATCH_SIZE
  );

  onProgress?.({
    current: 0,
    total,
    added: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    phase: 'syncing',
  });

  /*
   * ---------------------------------------------------------------
   * TRAITEMENT DES LOTS
   * ---------------------------------------------------------------
   */

  for (
    let batchStart = 0;
    batchStart < movies.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = movies.slice(
      batchStart,
      batchStart + BATCH_SIZE
    );

    /*
     * Une transaction SQLite pour chaque lot.
     */

    await db.withTransactionAsync(async () => {
      for (const movie of batch) {
        const localMovie = localMap.get(
          movie.stream_id
        );

        /*
         * ---------------------------------------------------------
         * NOUVEAU FILM
         * ---------------------------------------------------------
         */

        if (!localMovie) {
          await db.runAsync(
            `
            INSERT INTO movies (
              stream_id,
              name,
              stream_type,
              stream_icon,
              rating,
              rating_5based,
              added,
              is_adult,
              container_extension,
              custom_sid,
              direct_source,
              category_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            movie.stream_id,
            movie.name,
            movie.stream_type,
            movie.stream_icon,
            movie.rating,
            movie.rating_5based,
            movie.added,
            movie.is_adult,
            movie.container_extension,
            movie.custom_sid,
            movie.direct_source,
            movie.category_id
          );

          added++;

          continue;
        }

        /*
         * ---------------------------------------------------------
         * FILM EXISTANT
         * ---------------------------------------------------------
         */

        const remoteSignature =
          getMovieSignature(movie);

        const localSignature =
          getMovieSignature(localMovie);

        /*
         * Aucun changement
         */

        if (
          remoteSignature === localSignature
        ) {
          unchanged++;

          continue;
        }

        /*
         * Film modifié
         */

        await db.runAsync(
          `
          UPDATE movies
          SET
            name = ?,
            stream_type = ?,
            stream_icon = ?,
            rating = ?,
            rating_5based = ?,
            added = ?,
            is_adult = ?,
            container_extension = ?,
            custom_sid = ?,
            direct_source = ?,
            category_id = ?
          WHERE stream_id = ?
          `,
          movie.name,
          movie.stream_type,
          movie.stream_icon,
          movie.rating,
          movie.rating_5based,
          movie.added,
          movie.is_adult,
          movie.container_extension,
          movie.custom_sid,
          movie.direct_source,
          movie.category_id,
          movie.stream_id
        );

        updated++;
      }
    });

    /*
     * -------------------------------------------------------------
     * PROGRESSION DU LOT
     * -------------------------------------------------------------
     */

    const current = Math.min(
      batchStart + batch.length,
      total
    );

    console.log(
      `FILMS : ${current}/${total} | ` +
      `ajoutés=${added} | ` +
      `modifiés=${updated} | ` +
      `inchangés=${unchanged}`
    );

    onProgress?.({
      current,
      total,
      added,
      updated,
      deleted,
      unchanged,
      phase: 'syncing',
    });
  }

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 7 : recherche des films supprimés
   * ---------------------------------------------------------------
   */

  const moviesToDelete: number[] = [];

  for (const localMovie of localMovies) {
    if (
      !remoteIds.has(
        localMovie.stream_id
      )
    ) {
      moviesToDelete.push(
        localMovie.stream_id
      );
    }
  }

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 8 : suppression par lots
   * ---------------------------------------------------------------
   */

  if (moviesToDelete.length > 0) {
    console.log(
      'FILMS À SUPPRIMER DE SQLITE :',
      moviesToDelete.length
    );

    onProgress?.({
      current: 0,
      total: moviesToDelete.length,
      added,
      updated,
      deleted: 0,
      unchanged,
      phase: 'deleting',
    });

    for (
      let batchStart = 0;
      batchStart < moviesToDelete.length;
      batchStart += BATCH_SIZE
    ) {
      const batch = moviesToDelete.slice(
        batchStart,
        batchStart + BATCH_SIZE
      );

      await db.withTransactionAsync(async () => {
        for (const streamId of batch) {
          await db.runAsync(
            `
            DELETE FROM movies
            WHERE stream_id = ?
            `,
            streamId
          );

          deleted++;
        }
      });

      const current = Math.min(
        batchStart + batch.length,
        moviesToDelete.length
      );

      console.log(
        `SUPPRESSION FILMS : ${current}/${moviesToDelete.length} | ` +
        `supprimés=${deleted}`
      );

      onProgress?.({
        current,
        total: moviesToDelete.length,
        added,
        updated,
        deleted,
        unchanged,
        phase: 'deleting',
      });
    }
  }

  /*
   * ---------------------------------------------------------------
   * ÉTAPE 9 : résultat
   * ---------------------------------------------------------------
   */

  const changed =
    added > 0 ||
    updated > 0 ||
    deleted > 0;

  console.log(
    'SYNCHRONISATION FILMS TERMINÉE'
  );

  console.log(
    'Total :',
    movies.length
  );

  console.log(
    'Ajoutés :',
    added
  );

  console.log(
    'Modifiés :',
    updated
  );

  console.log(
    'Supprimés :',
    deleted
  );

  console.log(
    'Inchangés :',
    unchanged
  );

  onProgress?.({
    current: total,
    total,
    added,
    updated,
    deleted,
    unchanged,
    phase: 'done',
  });

  return {
    total,
    added,
    updated,
    deleted,
    unchanged,
    changed,
  };
}

/*
|--------------------------------------------------------------------------
| ANCIENNE FONCTION syncMovies
|--------------------------------------------------------------------------
*/

export async function syncMovies() {
  const result =
    await syncMoviesWithProgress();

  return (
    result.added +
    result.updated
  );
}

/*
|--------------------------------------------------------------------------
| NOMBRE DE FILMS
|--------------------------------------------------------------------------
*/

export async function getMoviesCountFromDatabase(
  categoryId?: string
): Promise<number> {
  const db = await initDatabase();

  let result;

  if (categoryId) {
    result = await db.getFirstAsync<{
      count: number;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM movies
      WHERE category_id = ?
      `,
      categoryId
    );
  } else {
    result = await db.getFirstAsync<{
      count: number;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM movies
      `
    );
  }

  return Number(
    result?.count ?? 0
  );
}

/*
|--------------------------------------------------------------------------
| CATÉGORIES DEPUIS SQLITE
|--------------------------------------------------------------------------
*/

export async function getCategoriesFromDatabase() {
  const db = await initDatabase();

  const categories =
    await db.getAllAsync<{
      category_id: string;
      category_name: string;
    }>(
      `
      SELECT
        category_id,
        category_name
      FROM categories
      ORDER BY category_name ASC
      `
    );

  console.log(
    'CATÉGORIES LUES DEPUIS SQLITE :',
    categories.length
  );

  return categories;
}

/*
|--------------------------------------------------------------------------
| FILMS DEPUIS SQLITE
|--------------------------------------------------------------------------
*/

export async function getMoviesFromDatabase(
  categoryId?: string,
  limit: number = 100,
  offset: number = 0
): Promise<Movie[]> {
  const db = await initDatabase();

  if (categoryId) {
    const movies =
      await db.getAllAsync<Movie>(
        `
        SELECT
          stream_id,
          name,
          stream_icon,
          rating,
          rating_5based,
          container_extension,
          category_id
        FROM movies
        WHERE category_id = ?
        ORDER BY name ASC
        LIMIT ? OFFSET ?
        `,
        categoryId,
        limit,
        offset
      );

    console.log(
      'FILMS LUS DEPUIS SQLITE :',
      movies.length,
      '| OFFSET :',
      offset,
      '| LIMIT :',
      limit
    );

    return movies;
  }

  const movies =
    await db.getAllAsync<Movie>(
      `
      SELECT
        stream_id,
        name,
        stream_icon,
        rating,
        rating_5based,
        container_extension,
        category_id
      FROM movies
      ORDER BY name ASC
      LIMIT ? OFFSET ?
      `,
      limit,
      offset
    );

  console.log(
    'FILMS LUS DEPUIS SQLITE :',
    movies.length,
    '| OFFSET :',
    offset,
    '| LIMIT :',
    limit
  );

  return movies;
}

/*
|--------------------------------------------------------------------------
| RECHERCHE FILMS
|--------------------------------------------------------------------------
*/

export async function searchMoviesFromDatabase(
  search: string,
  categoryId?: string,
  limit = 100,
  offset = 0
): Promise<Movie[]> {
  const db = await initDatabase();

  const searchTerm =
    '%' + search.trim() + '%';

  if (categoryId) {
    const movies =
      await db.getAllAsync<Movie>(
        `
        SELECT
          stream_id,
          name,
          stream_icon,
          rating,
          rating_5based,
          container_extension,
          category_id
        FROM movies
        WHERE category_id = ?
          AND name LIKE ? COLLATE NOCASE
        ORDER BY name ASC
        LIMIT ? OFFSET ?
        `,
        categoryId,
        searchTerm,
        limit,
        offset
      );

    return movies;
  }

  const movies =
    await db.getAllAsync<Movie>(
      `
      SELECT
        stream_id,
        name,
        stream_icon,
        rating,
        rating_5based,
        container_extension,
        category_id
      FROM movies
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY name ASC
      LIMIT ? OFFSET ?
      `,
      searchTerm,
      limit,
      offset
    );

  return movies;
}

/*
|--------------------------------------------------------------------------
| COMPTEUR DE RECHERCHE
|--------------------------------------------------------------------------
*/

export async function getSearchMoviesCountFromDatabase(
  search: string,
  categoryId?: string
) {
  const db = await initDatabase();

  const searchTerm =
    '%' + search.trim() + '%';

  if (categoryId) {
    const result =
      await db.getFirstAsync<{
        count: number;
      }>(
        `
        SELECT COUNT(*) AS count
        FROM movies
        WHERE category_id = ?
          AND name LIKE ? COLLATE NOCASE
        `,
        categoryId,
        searchTerm
      );

    return result?.count ?? 0;
  }

  const result =
    await db.getFirstAsync<{
      count: number;
    }>(
      `
      SELECT COUNT(*) AS count
      FROM movies
      WHERE name LIKE ? COLLATE NOCASE
      `,
      searchTerm
    );

  return result?.count ?? 0;
}