-- شغّل هذا الملف بـ Supabase: SQL Editor → New query → الصق → Run
-- يسوي جداول RX WA (clients, qa, messages)

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_id TEXT UNIQUE NOT NULL,
  wa_token TEXT NOT NULL,
  flow TEXT DEFAULT 'qa'
);

CREATE TABLE IF NOT EXISTS qa (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  keywords TEXT,
  reply TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  from_num TEXT,
  direction TEXT,
  text TEXT,
  at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_client ON qa(client_id);
CREATE INDEX IF NOT EXISTS idx_msg_client ON messages(client_id);
CREATE INDEX IF NOT EXISTS idx_msg_id ON messages(id DESC);
