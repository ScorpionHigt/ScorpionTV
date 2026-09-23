import { initDatabase } from '../database/database';

import {
  syncLiveTVIfNeeded,
  LiveSyncProgress,
} from '../database/liveRepository';

import {
  syncCategories,
  syncMoviesWithProgress,
  MovieSyncProgress,
} from '../database/catalogRepository';

import {
  syncSeriesTV,
  SeriesSyncProgress,
} from '../database/seriesRepository';

/**
 * Les catalogues gérés par la synchronisation initiale.
 */
export type CatalogType = 'live' | 'movies' | 'series';

/**
 * État d'un catalogue pendant sa synchronisation.
 */
export type CatalogSyncStatus =
  | 'waiting'
  | 'loading'
  | 'syncing'
  | 'completed'
  | 'error';

/**
 * État normalisé d'un catalogue.
 */
export type CatalogSyncState = {
  status: CatalogSyncStatus;
  phase: string;
  current: number;
  total: number;

  added?: number;
  updated?: number;
  deleted?: number;
  unchanged?: number;

  error?: string;
};

/**
 * État global de la synchronisation initiale.
 */
export type InitialCatalogSyncState = {
  live: CatalogSyncState;
  movies: CatalogSyncState;
  series: CatalogSyncState;
};

/**
 * Callback utilisé par l'écran initial-sync.
 */
export type InitialCatalogSyncProgressCallback = (
  state: InitialCatalogSyncState,
) => void;

/**
 * État initial affiché avant le lancement.
 */
export const INITIAL_CATALOG_SYNC_STATE: InitialCatalogSyncState = {
  live: {
    status: 'waiting',
    phase: 'En attente',
    current: 0,
    total: 0,
  },

  movies: {
    status: 'waiting',
    phase: 'En attente',
    current: 0,
    total: 0,
  },

  series: {
    status: 'waiting',
    phase: 'En attente',
    current: 0,
    total: 0,
  },
};

/**
 * Synchronisation initiale des catalogues.
 *
 * Important :
 * - on ne considère un catalogue comme terminé qu'après
 *   une synchronisation réussie ;
 * - les catalogues déjà marqués "completed" ne sont pas relancés ;
 * - la synchronisation est volontairement séquentielle pour
 *   éviter de surcharger SQLite et le serveur Xtream ;
 * - les console.log sont conservés pendant le développement.
 */
export async function runInitialCatalogSync(
  onProgress?: InitialCatalogSyncProgressCallback,
): Promise<InitialCatalogSyncState> {
  const state: InitialCatalogSyncState = {
    live: {
      ...INITIAL_CATALOG_SYNC_STATE.live,
    },

    movies: {
      ...INITIAL_CATALOG_SYNC_STATE.movies,
    },

    series: {
      ...INITIAL_CATALOG_SYNC_STATE.series,
    },
  };

  const db = await initDatabase();

  console.log('========================================');
  console.log('SCORPION TV — SYNCHRONISATION INITIALE');
  console.log('========================================');

  /**
   * ---------------------------------------------------------
   * Vérification de l'état persistant
   * ---------------------------------------------------------
   */

  const syncStates = await db.getAllAsync<{
    catalog: string;
    status: string;
  }>(
    `
      SELECT catalog, status
      FROM catalog_sync_state
    `,
  );

  const persistedStates: Record<string, string> = {};

  for (const row of syncStates) {
    persistedStates[row.catalog] = row.status;
  }

  console.log(
    'État persistant des catalogues :',
    persistedStates,
  );

  /**
   * ---------------------------------------------------------
   * LIVE TV
   * ---------------------------------------------------------
   */

  if (persistedStates.live === 'completed') {
    state.live = {
      status: 'completed',
      phase: 'Déjà synchronisé',
      current: 1,
      total: 1,
    };

    console.log('📺 LIVE TV — déjà synchronisé');

    notify(onProgress, state);
  } else {
    state.live = {
      status: 'loading',
      phase: 'Préparation du Live TV',
      current: 0,
      total: 0,
    };

    notify(onProgress, state);

    try {
      console.log('📺 LIVE TV — début synchronisation');

      const result = await syncLiveTVIfNeeded(
        (progress: LiveSyncProgress) => {
          state.live = normalizeLiveProgress(progress);

          notify(onProgress, state);
        },
      );

      console.log(
        '📺 LIVE TV — synchronisation terminée',
        result,
      );

      /**
       * Même si le repository indique qu'aucune modification
       * n'était nécessaire, le catalogue est considéré comme
       * initialisé avec succès.
       */
      state.live = {
        status: 'completed',
        phase: result.synchronized
          ? 'Synchronisation terminée'
          : 'Déjà à jour',
        current:
          result.channelsCount > 0
            ? result.channelsCount
            : 1,
        total:
          result.channelsCount > 0
            ? result.channelsCount
            : 1,
      };

      await markCatalogCompleted('live');

      notify(onProgress, state);

      console.log('📺 LIVE TV — marqué completed');
    } catch (error) {
      console.error(
        '❌ LIVE TV — erreur synchronisation :',
        error,
      );

      state.live = {
        ...state.live,
        status: 'error',
        phase: 'Erreur',
        error: getErrorMessage(error),
      };

      notify(onProgress, state);

      /**
       * On arrête la synchronisation initiale.
       *
       * Le catalogue n'est volontairement PAS marqué completed.
       */
      throw error;
    }
  }

  /**
   * ---------------------------------------------------------
   * FILMS
   * ---------------------------------------------------------
   */

  if (persistedStates.movies === 'completed') {
    state.movies = {
      status: 'completed',
      phase: 'Déjà synchronisé',
      current: 1,
      total: 1,
    };

    console.log('🎬 FILMS — déjà synchronisés');

    notify(onProgress, state);
  } else {
    state.movies = {
      status: 'loading',
      phase: 'Préparation des films',
      current: 0,
      total: 0,
    };

    notify(onProgress, state);

    try {
      console.log('🎬 FILMS — début synchronisation');

      /**
       * Les catégories doivent être disponibles avant
       * la synchronisation des films.
       */
      await syncCategories();

      console.log('🎬 FILMS — catégories synchronisées');

      const result = await syncMoviesWithProgress(
        (progress: MovieSyncProgress) => {
          state.movies = normalizeMovieProgress(progress);

          notify(onProgress, state);
        },
      );

      console.log(
        '🎬 FILMS — synchronisation terminée',
        result,
      );

      state.movies = {
        status: 'completed',
        phase: 'Synchronisation terminée',
        current: result.total,
        total: result.total,
        added: result.added,
        updated: result.updated,
        deleted: result.deleted,
        unchanged: result.unchanged,
      };

      await markCatalogCompleted('movies');

      notify(onProgress, state);

      console.log('🎬 FILMS — marqué completed');
    } catch (error) {
      console.error(
        '❌ FILMS — erreur synchronisation :',
        error,
      );

      state.movies = {
        ...state.movies,
        status: 'error',
        phase: 'Erreur',
        error: getErrorMessage(error),
      };

      notify(onProgress, state);

      throw error;
    }
  }

  /**
   * ---------------------------------------------------------
   * SÉRIES
   * ---------------------------------------------------------
   */

  if (persistedStates.series === 'completed') {
    state.series = {
      status: 'completed',
      phase: 'Déjà synchronisé',
      current: 1,
      total: 1,
    };

    console.log('📚 SÉRIES — déjà synchronisées');

    notify(onProgress, state);
  } else {
    state.series = {
      status: 'loading',
      phase: 'Préparation des séries',
      current: 0,
      total: 0,
    };

    notify(onProgress, state);

    try {
      console.log('📚 SÉRIES — début synchronisation');

      const result = await syncSeriesTV(
        (progress: SeriesSyncProgress) => {
          state.series = normalizeSeriesProgress(progress);

          notify(onProgress, state);
        },
      );

      console.log(
        '📚 SÉRIES — synchronisation terminée',
        result,
      );

      state.series = {
          status: 'completed',
          phase: 'Synchronisation terminée',
          current: result.seriesCount,
          total: result.seriesCount,
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          unchanged: result.unchanged,
        };

      await markCatalogCompleted('series');

      notify(onProgress, state);

      console.log('📚 SÉRIES — marqué completed');
    } catch (error) {
      console.error(
        '❌ SÉRIES — erreur synchronisation :',
        error,
      );

      state.series = {
        ...state.series,
        status: 'error',
        phase: 'Erreur',
        error: getErrorMessage(error),
      };

      notify(onProgress, state);

      throw error;
    }
  }

  /**
   * ---------------------------------------------------------
   * TERMINÉ
   * ---------------------------------------------------------
   */

  console.log('========================================');
  console.log('SCORPION TV — SYNCHRONISATION TERMINÉE');
  console.log('========================================');

  notify(onProgress, state);

  return state;
}

/**
 * Vérifie si au moins un catalogue doit encore
 * être synchronisé initialement.
 */
export async function needsInitialCatalogSync(): Promise<boolean> {
  const db = await initDatabase();

  const rows = await db.getAllAsync<{
    catalog: string;
    status: string;
  }>(
    `
      SELECT catalog, status
      FROM catalog_sync_state
      WHERE status != 'completed'
    `,
  );

  const needsSync = rows.length > 0;

  console.log(
    '🔎 Synchronisation initiale nécessaire :',
    needsSync,
  );

  if (rows.length > 0) {
    console.log(
      'Catalogues à synchroniser :',
      rows.map((row) => row.catalog),
    );
  }

  return needsSync;
}

/**
 * Marque un catalogue comme correctement initialisé.
 */
async function markCatalogCompleted(
  catalog: CatalogType,
): Promise<void> {
  const db = await initDatabase();

  await db.runAsync(
    `
      INSERT INTO catalog_sync_state
        (catalog, status, updated_at)
      VALUES
        (?, 'completed', ?)
      ON CONFLICT(catalog)
      DO UPDATE SET
        status = 'completed',
        updated_at = excluded.updated_at
    `,
    catalog,
    new Date().toISOString(),
  );

  console.log(
    `💾 État SQLite : ${catalog} = completed`,
  );
}

/**
 * Normalisation du progress Live TV.
 */
function normalizeLiveProgress(
  progress: LiveSyncProgress,
): CatalogSyncState {
  let phase = 'Synchronisation';

  if (progress.phase === 'categories') {
    phase = 'Synchronisation des catégories';
  }

  if (progress.phase === 'channels') {
    phase = 'Synchronisation des chaînes';
  }

  if (progress.phase === 'completed') {
    phase = 'Synchronisation terminée';
  }

  return {
    status:
      progress.phase === 'completed'
        ? 'completed'
        : 'syncing',

    phase,

    current: progress.current ?? 0,
    total: progress.total ?? 0,
  };
}

/**
 * Normalisation du progress Films.
 */
function normalizeMovieProgress(
  progress: MovieSyncProgress,
): CatalogSyncState {
  let phase = 'Synchronisation';

  switch (progress.phase) {
    case 'checking':
      phase = 'Analyse du catalogue';
      break;

    case 'syncing':
      phase = 'Synchronisation des films';
      break;

    case 'deleting':
      phase = 'Suppression des films obsolètes';
      break;

    case 'done':
      phase = 'Synchronisation terminée';
      break;
  }

  return {
    status:
      progress.phase === 'done'
        ? 'completed'
        : 'syncing',

    phase,

    current: progress.current ?? 0,
    total: progress.total ?? 0,

    added: progress.added,
    updated: progress.updated,
    deleted: progress.deleted,
    unchanged: progress.unchanged,
  };
}

/**
 * Normalisation du progress Séries.
 */
function normalizeSeriesProgress(
  progress: SeriesSyncProgress,
): CatalogSyncState {
  let phase = 'Synchronisation';

  switch (progress.phase) {
    case 'checking':
      phase = 'Analyse du catalogue';
      break;

    case 'syncing':
      phase = 'Synchronisation des séries';
      break;

    case 'deleting':
      phase = 'Suppression des séries obsolètes';
      break;

    case 'done':
      phase = 'Synchronisation terminée';
      break;
  }

  return {
    status:
      progress.phase === 'done'
        ? 'completed'
        : 'syncing',

    phase,

    current: progress.current ?? 0,
    total: progress.total ?? 0,

    added: progress.added,
    updated: progress.updated,
    deleted: progress.deleted,
    unchanged: progress.unchanged,
  };
}

/**
 * Notifie l'écran de progression.
 */
function notify(
  callback: InitialCatalogSyncProgressCallback | undefined,
  state: InitialCatalogSyncState,
): void {
  if (!callback) {
    return;
  }

  callback({
    live: {
      ...state.live,
    },

    movies: {
      ...state.movies,
    },

    series: {
      ...state.series,
    },
  });
}

/**
 * Transforme n'importe quelle erreur en message lisible.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Une erreur inconnue est survenue.';
}