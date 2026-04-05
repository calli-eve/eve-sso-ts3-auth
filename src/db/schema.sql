-- Session store (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    varchar      NOT NULL COLLATE "default",
  "sess"   json         NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Characters who have authenticated via EVE SSO
CREATE TABLE IF NOT EXISTS eve_characters (
  character_id   BIGINT       PRIMARY KEY,
  character_name TEXT         NOT NULL,
  corporation_id BIGINT,
  alliance_id    BIGINT,
  access_token   TEXT,
  refresh_token  TEXT,
  token_expiry   TIMESTAMPTZ,
  last_seen      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Corp or alliance -> one or more TS3 server group IDs
CREATE TABLE IF NOT EXISTS ts3_mappings (
  id            SERIAL       PRIMARY KEY,
  entity_type   TEXT         NOT NULL CHECK (entity_type IN ('corporation','alliance')),
  entity_id     BIGINT       NOT NULL,
  entity_name   TEXT         NOT NULL,
  ts3_group_ids INTEGER[]    NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id)
);

-- Short-lived auth tokens issued after ESI check
CREATE TABLE IF NOT EXISTS auth_tokens (
  token          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id   BIGINT       NOT NULL REFERENCES eve_characters(character_id),
  ts3_group_ids  INTEGER[]    NOT NULL,
  issued_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  used_at        TIMESTAMPTZ,
  ts3_client_db_id INTEGER,
  status         TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','used','expired'))
);

-- Auth event log
CREATE TABLE IF NOT EXISTS auth_log (
  id               SERIAL      PRIMARY KEY,
  character_id     BIGINT,
  character_name   TEXT,
  ts3_client_db_id INTEGER,
  ts3_nickname     TEXT,
  token            UUID,
  groups_assigned  INTEGER[],
  event_type       TEXT        NOT NULL,
  detail           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin characters (can also be managed purely via ADMIN_CHARACTER_IDS env var)
CREATE TABLE IF NOT EXISTS admin_characters (
  character_id   BIGINT  PRIMARY KEY,
  character_name TEXT    NOT NULL,
  added_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
