import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/k8s-transfer.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS node_configs (
      id TEXT PRIMARY KEY,
      node_name TEXT NOT NULL UNIQUE,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT NOT NULL DEFAULT 'password',
      password TEXT,
      private_key TEXT,
      passphrase TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      ip TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Unknown',
      version TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'worker',
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS image_cache (
      id TEXT PRIMARY KEY,
      node_name TEXT NOT NULL,
      image_name TEXT NOT NULL,
      repository TEXT NOT NULL,
      tag TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(node_name, image_name)
    );

    CREATE TABLE IF NOT EXISTS transfer_history (
      id TEXT PRIMARY KEY,
      image_name TEXT NOT NULL,
      source_node TEXT NOT NULL,
      destination_node TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('kubectl_path', '/usr/local/bin/kubectl'),
      ('ssh_timeout', '30000'),
      ('transfer_timeout', '300000'),
      ('auto_refresh_interval', '60');
  `);

  console.log('Database initialized at:', DB_PATH);
}

export default db;
