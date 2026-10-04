CREATE TABLE auth_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  email text NOT NULL CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX auth_sessions_email_idx ON auth_sessions(email) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
