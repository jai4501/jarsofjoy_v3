-- WhatsApp configuration
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp sessions to track conversation state
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    phone_number TEXT PRIMARY KEY,
    state TEXT NOT NULL DEFAULT 'START',
    data JSONB DEFAULT '{}'::jsonb,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp message logs
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_id TEXT UNIQUE, -- Message ID from WhatsApp
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    message_type TEXT NOT NULL, -- text, image, interactive, etc.
    content JSONB NOT NULL,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some initial config keys if needed
-- INSERT INTO whatsapp_config (key, value) VALUES ('verify_token', 'my_secret_verify_token');
