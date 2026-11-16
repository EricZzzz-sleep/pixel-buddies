-- Pixel Buddies 公测：统计与反馈表（Cloudflare D1）
-- 创建： npx wrangler d1 execute pixel-buddies --remote --file=functions/schema.sql
-- 不存 IP、不存昵称/邮箱/照片；iid 是玩家同意后才生成的随机编号。
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  sid TEXT NOT NULL,
  iid TEXT,
  app_version TEXT,
  platform TEXT,
  name TEXT NOT NULL,
  client_ts INTEGER,
  props TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events (name, received_at);
CREATE INDEX IF NOT EXISTS idx_events_iid ON events (iid, received_at);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  app_version TEXT,
  platform TEXT,
  viewport TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_time ON feedback (received_at);
