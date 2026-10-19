-- Pirate Loot games timed by the server; score is set once the replay has been accepted.
CREATE TABLE pirate_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  seed INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  score INTEGER,
  finished_at INTEGER
);
CREATE INDEX pirate_runs_finished ON pirate_runs (finished_at);
