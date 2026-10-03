import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function initDatabase() {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }

  return databasePromise;
}

async function openDatabase() {
  const db = await SQLite.openDatabaseAsync(
    'scorpiontv_v2.db'
  );

  /*
  ============================================================
  FILMS
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id TEXT PRIMARY KEY NOT NULL,
      category_name TEXT NOT NULL,
      icon TEXT,
      is_adult INTEGER,
      parent_id INTEGER,
      stream_count INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS movies (
      stream_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      stream_type TEXT,
      stream_icon TEXT,
      rating TEXT,
      rating_5based REAL,
      added TEXT,
      is_adult TEXT,
      container_extension TEXT,
      custom_sid TEXT,
      direct_source TEXT,
      category_id TEXT
    );
  `);

  /*
  ============================================================
  LIVE TV
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS live_categories (
      category_id TEXT PRIMARY KEY NOT NULL,
      category_name TEXT NOT NULL,
      parent_id INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS live_channels (
      stream_id INTEGER PRIMARY KEY NOT NULL,
      num INTEGER,
      name TEXT NOT NULL,
      stream_type TEXT,
      epg_channel_id TEXT,
      added TEXT,
      is_adult TEXT,
      category_id TEXT,
      custom_sid TEXT,
      tv_archive INTEGER,
      direct_source TEXT,
      tv_archive_duration INTEGER
    );
  `);

  /*
  ============================================================
  SÉRIES
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS series_categories (
      category_id TEXT PRIMARY KEY NOT NULL,
      category_name TEXT NOT NULL,
      parent_id INTEGER
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS series (
      series_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      plot TEXT,
      cast TEXT,
      director TEXT,
      genre TEXT,
      release_date TEXT,
      rating TEXT,
      rating_5based REAL,
      cover TEXT,
      backdrop_path TEXT,
      youtube_trailer TEXT,
      episode_run_time INTEGER,
      category_id TEXT
    );
  `);

  /*
  ============================================================
  MIGRATION SÉRIES
  ============================================================
  *
  * Les anciennes installations possèdent déjà la table
  * "series" sans la colonne "cover".
  *
  * CREATE TABLE IF NOT EXISTS ne modifie pas une table
  * existante.
  *
  * On vérifie donc explicitement si "cover" existe.
  */

  const seriesColumns =
    await db.getAllAsync<{
      name: string;
    }>(
      `
      PRAGMA table_info(series);
      `
    );

  const hasCoverColumn =
    seriesColumns.some(
      (column) =>
        column.name === 'cover'
    );

  if (!hasCoverColumn) {
    await db.execAsync(`
      ALTER TABLE series
      ADD COLUMN cover TEXT;
    `);

    console.log(
      'SQLite SERIES : colonne cover ajoutée.'
    );
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS series_episodes (
      episode_id INTEGER PRIMARY KEY NOT NULL,
      series_id INTEGER NOT NULL,
      season INTEGER,
      episode INTEGER,
      title TEXT,
      container_extension TEXT,
      plot TEXT,
      rating TEXT,
      rating_5based REAL,
      duration TEXT,
      duration_seconds INTEGER,
      direct_source TEXT,
      added TEXT,
      custom_sid TEXT,
      episode_num INTEGER
    );
  `);

  /*
  ============================================================
  M3U
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS m3u_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT,
      file_path TEXT,
      last_sync TEXT,
      enabled INTEGER DEFAULT 1
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS m3u_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (source_id)
        REFERENCES m3u_sources(id)
        ON DELETE CASCADE
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS m3u_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category_id INTEGER,
      tvg_id TEXT,
      tvg_name TEXT,
      group_title TEXT,
      tvg_language TEXT,
      tvg_country TEXT,
      stream_type TEXT,
      FOREIGN KEY (source_id)
        REFERENCES m3u_sources(id)
        ON DELETE CASCADE,
      FOREIGN KEY (category_id)
        REFERENCES m3u_categories(id)
        ON DELETE SET NULL
    );
  `);

  /*
  ============================================================
  NOTIFICATIONS
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY NOT NULL,
      user_id INTEGER NOT NULL,
      subscription_id INTEGER,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);

  /*
  ============================================================
  ÉTAT DE SYNCHRONISATION DES CATALOGUES
  ============================================================
  */

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS catalog_sync_state (
      catalog TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      updated_at TEXT
    );
  `);

  await db.execAsync(`
    INSERT OR IGNORE INTO catalog_sync_state
      (catalog, status, updated_at)
    VALUES
      ('live', 'pending', NULL),
      ('movies', 'pending', NULL),
      ('series', 'pending', NULL);
  `);

  console.log('SQLite ScorpionTV OK');

  return db;
}
