-- Esquema para chat-ia-widget en Neon (PostgreSQL)
-- Ejecuta: npm run db:init  (o pega esto en el SQL Editor de Neon)

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  visitor_name TEXT,
  visitor_email TEXT,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración idempotente para BDs ya creadas sin columna ip
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ip TEXT;
CREATE INDEX IF NOT EXISTS idx_conversations_ip ON conversations(ip);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);
