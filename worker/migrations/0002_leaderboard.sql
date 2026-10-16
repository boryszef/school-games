-- Players with generated nicknames <Color><Animal><number>; only a hash of the token is kept.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  color INTEGER NOT NULL,
  animal INTEGER NOT NULL,
  number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (color, animal, number)
);

-- Robot Maze runs timed by the server; time_ms is set once the replay has reached the exit.
CREATE TABLE maze_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id),
  seed INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  time_ms INTEGER,
  penalty_ms INTEGER,
  finished_at INTEGER
);
CREATE INDEX maze_runs_finished ON maze_runs (finished_at);

-- One player's word on a Tug of War match, waiting for the other player's.
CREATE TABLE duel_reports (
  match_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL REFERENCES players (id),
  opponent_id TEXT NOT NULL REFERENCES players (id),
  won INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, reporter_id)
);

-- Wins both players confirmed.
CREATE TABLE duel_wins (
  match_id TEXT PRIMARY KEY,
  winner_id TEXT NOT NULL REFERENCES players (id),
  loser_id TEXT NOT NULL REFERENCES players (id),
  won_at INTEGER NOT NULL
);
CREATE INDEX duel_wins_pair ON duel_wins (winner_id, loser_id, won_at);
