-- Run once in the Cloudflare dashboard: Storage & Databases > D1 > foresthounds-enquiries > Console.
CREATE TABLE IF NOT EXISTS enquiries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT NOT NULL,
  town       TEXT NOT NULL,
  dog        TEXT NOT NULL,
  breed      TEXT,
  service    TEXT,
  notes      TEXT,
  emailed    INTEGER NOT NULL DEFAULT 0
);
