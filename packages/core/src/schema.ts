/**
 * Canonical schema for the awesome-claude-token-stack SQLite store.
 *
 * All layers (compress/sandbox/observe/memory) share a single database with
 * WAL mode and FTS5 virtual tables. This keeps the on-disk format stable,
 * makes cross-layer queries possible, and avoids the coordination overhead
 * of a database-per-layer.
 */
export const SCHEMA_SQL = /* sql */ `
  -- ---------- sessions ----------
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    agent       TEXT NOT NULL,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    cwd         TEXT NOT NULL,
    meta_json   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

  -- ---------- per-turn metrics ----------
  CREATE TABLE IF NOT EXISTS turn_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_index      INTEGER NOT NULL,
    at              INTEGER NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    tool_tokens     INTEGER NOT NULL DEFAULT 0,
    context_fill    REAL    NOT NULL DEFAULT 0.0,
    meta_json       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_turn_metrics_session ON turn_metrics(session_id);

  -- ---------- quality score history ----------
  CREATE TABLE IF NOT EXISTS quality_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    turn_index      INTEGER NOT NULL,
    at              INTEGER NOT NULL,
    score           REAL    NOT NULL,
    grade           TEXT    NOT NULL,
    signals_json    TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_quality_scores_session ON quality_scores(session_id);

  -- ---------- persistent memory / observations ----------
  CREATE TABLE IF NOT EXISTS observations (
    id              TEXT PRIMARY KEY,
    kind            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    tags_json       TEXT NOT NULL DEFAULT '[]',
    source          TEXT,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    accessed_at     INTEGER,
    access_count    INTEGER NOT NULL DEFAULT 0,
    validity        REAL    NOT NULL DEFAULT 1.0,
    ttl_seconds     INTEGER,
    superseded_by   TEXT REFERENCES observations(id) ON DELETE SET NULL,
    content_hash    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_observations_kind ON observations(kind);
  CREATE INDEX IF NOT EXISTS idx_observations_updated_at ON observations(updated_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
    id UNINDEXED,
    kind,
    title,
    body,
    tags,
    tokenize = 'porter unicode61'
  );

  CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
    INSERT INTO observations_fts(id, kind, title, body, tags)
      VALUES (new.id, new.kind, new.title, new.body, new.tags_json);
  END;
  CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
    DELETE FROM observations_fts WHERE id = old.id;
  END;
  CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
    DELETE FROM observations_fts WHERE id = old.id;
    INSERT INTO observations_fts(id, kind, title, body, tags)
      VALUES (new.id, new.kind, new.title, new.body, new.tags_json);
  END;

  -- ---------- content index (sandbox) ----------
  CREATE TABLE IF NOT EXISTS content (
    id              TEXT PRIMARY KEY,
    source          TEXT NOT NULL,
    title           TEXT,
    mime            TEXT,
    bytes           INTEGER NOT NULL,
    chunk_count     INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER,
    content_hash    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_source ON content(source);
  CREATE INDEX IF NOT EXISTS idx_content_hash ON content(content_hash);

  CREATE TABLE IF NOT EXISTS content_chunks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id      TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    text            TEXT NOT NULL,
    byte_offset     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_content_chunks_cid ON content_chunks(content_id);

  CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
    chunk_id UNINDEXED,
    content_id UNINDEXED,
    source,
    title,
    text,
    tokenize = 'porter unicode61'
  );

  CREATE TRIGGER IF NOT EXISTS content_chunks_ai AFTER INSERT ON content_chunks BEGIN
    INSERT INTO content_fts(rowid, chunk_id, content_id, source, title, text)
      SELECT new.id, new.id, new.content_id, c.source, c.title, new.text
      FROM content c WHERE c.id = new.content_id;
  END;
  CREATE TRIGGER IF NOT EXISTS content_chunks_ad AFTER DELETE ON content_chunks BEGIN
    DELETE FROM content_fts WHERE rowid = old.id;
  END;

  -- ---------- tool result archive ----------
  CREATE TABLE IF NOT EXISTS tool_results (
    id              TEXT PRIMARY KEY,
    session_id      TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    tool_name       TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    input_json      TEXT NOT NULL,
    output          TEXT NOT NULL,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    truncated       INTEGER NOT NULL DEFAULT 0,
    content_hash    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tool_results_session ON tool_results(session_id);
  CREATE INDEX IF NOT EXISTS idx_tool_results_tool ON tool_results(tool_name);

  -- ---------- checkpoints ----------
  CREATE TABLE IF NOT EXISTS checkpoints (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at      INTEGER NOT NULL,
    context_fill    REAL NOT NULL,
    label           TEXT,
    payload_json    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);

  -- ---------- compression events ----------
  CREATE TABLE IF NOT EXISTS compression_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    at              INTEGER NOT NULL,
    kind            TEXT NOT NULL,
    source          TEXT,
    raw_tokens      INTEGER NOT NULL,
    compressed_tokens INTEGER NOT NULL,
    savings         REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_compression_events_session ON compression_events(session_id);
`;
