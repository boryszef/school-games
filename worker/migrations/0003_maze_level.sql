-- Robot Maze levels (standard 10×10, hard 20×20); runs from before levels were standard.
ALTER TABLE maze_runs ADD COLUMN level TEXT NOT NULL DEFAULT 'standard';
