CREATE TABLE IF NOT EXISTS "marketDataCache" (
  "cacheKey" varchar(128) PRIMARY KEY,
  "data" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "fetchedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "marketDataCache_expiresAt_idx" ON "marketDataCache" ("expiresAt");
