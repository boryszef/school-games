-- Waiting two-player games: the host's offer and, once a guest has joined, the guest's answer.
CREATE TABLE rooms (
  code TEXT PRIMARY KEY,
  offer TEXT NOT NULL,
  answer TEXT,
  created_at INTEGER NOT NULL
);
