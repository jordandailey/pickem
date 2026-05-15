-- ============================================
-- PICKEM CONTEST DATABASE SCHEMA
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users / Players
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seasons
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  entry_fee INTEGER DEFAULT 200,
  grand_prize INTEGER DEFAULT 2000,
  second_prize INTEGER DEFAULT 400,
  quarterly_prize INTEGER DEFAULT 350,
  point_win NUMERIC(3,1) DEFAULT 1.0,
  point_lock_win NUMERIC(3,1) DEFAULT 1.5,
  point_push NUMERIC(3,1) DEFAULT 0.5,
  picks_per_week INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quarters
CREATE TABLE quarters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  quarter_number INTEGER NOT NULL,
  name VARCHAR(50) NOT NULL
);

-- Weeks
CREATE TABLE weeks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  quarter_id UUID REFERENCES quarters(id),
  nfl_week INTEGER NOT NULL,
  cfb_week INTEGER NOT NULL,
  label VARCHAR(100),
  submission_deadline TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  picks_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games (the slate for a given week)
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  game_type VARCHAR(10) NOT NULL CHECK (game_type IN ('NFL', 'CFB')),
  conference VARCHAR(50),
  away_team VARCHAR(100) NOT NULL,
  home_team VARCHAR(100) NOT NULL,
  away_record VARCHAR(20),
  home_record VARCHAR(20),
  game_time TIMESTAMPTZ,
  tv_network VARCHAR(50),
  spread_away NUMERIC(5,1),
  spread_home NUMERIC(5,1),
  total NUMERIC(5,1),
  -- Results (filled after game)
  away_score INTEGER,
  home_score INTEGER,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'final', 'cancelled', 'postponed')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Picks
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  pick_type VARCHAR(10) NOT NULL CHECK (pick_type IN ('spread', 'over', 'under')),
  picked_team VARCHAR(100),
  is_lock BOOLEAN DEFAULT FALSE,
  result VARCHAR(10) CHECK (result IN ('win', 'loss', 'push', 'pending', 'void')),
  points_earned NUMERIC(3,1) DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, week_id, game_id, pick_type)
);

-- Weekly scores (denormalized for fast standings queries)
CREATE TABLE weekly_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE CASCADE,
  quarter_id UUID REFERENCES quarters(id),
  total_points NUMERIC(5,1) DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  lock_result VARCHAR(10),
  lock_points NUMERIC(3,1) DEFAULT 0,
  UNIQUE (user_id, week_id)
);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert active season
INSERT INTO seasons (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', '2025 Pick''em Season');

-- Insert quarters
INSERT INTO quarters (id, season_id, quarter_number, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1, 'Quarter 1 (Wks 9/6–9/27)'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 2, 'Quarter 2 (Wks 10/4–10/25)'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 3, 'Quarter 3 (Wks 11/1–11/29)'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 4, 'Quarter 4 (Wks 12/6–12/27)');

-- Insert players (password = lowercase first name, hashed at app start)
-- Passwords set in seed script below
INSERT INTO users (name, username, is_admin) VALUES
  ('Dan S.',   'dans',   false),
  ('Jack',     'jack',   true),
  ('Tony 2',   'tony2',  false),
  ('Rich K.',  'richk',  false),
  ('Luke',     'luke',   false),
  ('Steve S.', 'steves', false),
  ('Tony',     'tony',   false),
  ('Dan D.',   'dand',   false),
  ('Dave I.',  'davei',  false),
  ('Jordan',   'jordan', false),
  ('Scott',    'scott',  false),
  ('Sebby',    'sebby',  false),
  ('Troy',     'troy',   false),
  ('Joe Jr.',  'joejr',  false),
  ('Peter I.', 'peteri', false),
  ('Verdi',    'verdi',  false),
  ('Joey I.',  'joeyi',  false);
