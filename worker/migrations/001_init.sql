CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  credits INTEGER NOT NULL DEFAULT 100,
  plan TEXT NOT NULL DEFAULT 'free',
  is_banned INTEGER NOT NULL DEFAULT 0,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, provider, key_name)
);

CREATE TABLE IF NOT EXISTS storyboards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  story TEXT,
  platform TEXT,
  language TEXT NOT NULL DEFAULT 'id',
  art_style TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '9_16',
  total_scenes INTEGER NOT NULL DEFAULT 5,
  brain_model TEXT,
  image_model TEXT,
  video_model TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_public INTEGER NOT NULL DEFAULT 0,
  share_id TEXT UNIQUE,
  scenes_data TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS scene_assets (
  id TEXT PRIMARY KEY,
  storyboard_id TEXT NOT NULL REFERENCES storyboards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  scene_number INTEGER NOT NULL,
  image_url TEXT,
  image_model TEXT,
  enhanced_prompt TEXT,
  video_url TEXT,
  video_model TEXT,
  video_prompt TEXT,
  custom_video_prompt TEXT,
  audio_url TEXT,
  audio_voice TEXT,
  audio_engine TEXT,
  custom_vo TEXT,
  duration_seconds INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(storyboard_id, scene_number)
);

CREATE TABLE IF NOT EXISTS usage_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storyboard_id TEXT,
  service TEXT NOT NULL,
  model TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS admin_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  details TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_storyboards_user ON storyboards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scene_assets_storyboard ON scene_assets(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_log_target ON admin_log(target_user_id);
