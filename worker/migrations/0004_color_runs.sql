-- Color Invasion rounds timed by the server; score is set once the replay has been accepted.
CREATE TABLE color_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  seed INTEGER NOT NULL,
  lang TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  score INTEGER,
  finished_at INTEGER
);
CREATE INDEX color_runs_finished ON color_runs (lang, finished_at);
