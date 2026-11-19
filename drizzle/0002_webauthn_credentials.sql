-- Migration to add WebAuthn credentials table
-- Created for issue #199
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL,
    transports TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
