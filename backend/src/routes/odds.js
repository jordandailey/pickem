const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_BASE = 'https://api.the-odds-api.com/v4';

// Power 4 conferences + Notre Dame only
const ALLOWED_CFB_TEAMS = new Set([
  // Big Ten
  'Illinois Fighting Illini','Indiana Hoosiers','Iowa Hawkeyes','Maryland Terrapins',
  'Michigan Wolverines','Michigan State Spartans','Minnesota Golden Gophers',
  'Nebraska Cornhuskers','Northwestern Wildcats','Ohio State Buckeyes',
  'Penn State Nittany Lions','Purdue Boilermakers','Rutgers Scarlet Knights',
  'UCLA Bruins','USC Trojans','Washington Huskies','Wisconsin Badgers',
  'Oregon Ducks','Washington Huskies',
  // SEC
  'Alabama Crimson Tide','Arkansas Razorbacks','Auburn Tigers','Florida Gators',
  'Georgia Bulldogs','Kentucky Wildcats','LSU Tigers','Mississippi State Bulldogs',
  'Missouri Tigers','Ole Miss Rebels','South Carolina Gamecocks','Tennessee Volunteers',
  'Texas Aggies','Vanderbilt Commodores','Oklahoma Sooners','Texas Longhorns',
  // Big 12
  'Arizona Wildcats','Arizona State Sun Devils','Baylor Bears','BYU Cougars',
  'Cincinnati Bearcats','Colorado Buffaloes','Houston Cougars','Iowa State Cyclones',
  'Kansas Jayhawks','Kansas State Wildcats','Oklahoma State Cowboys','TCU Horned Frogs',
  'Texas Tech Red Raiders','UCF Knights','Utah Utes','West Virginia Mountaineers',
  // ACC
  'Boston College Eagles','California Golden Bears','Clemson Tigers','Duke Blue Devils',
  'Florida State Seminoles','Georgia Tech Yellow Jackets','Louisville Cardinals',
  'Miami Hurricanes','NC State Wolfpack','North Carolina Tar Heels','Pittsburgh Panthers',
  'SMU Mustangs','Stanford Cardinal','Syracuse Orange','Virginia Cavaliers',
  'Virginia Tech Hokies','Wake Forest Demon Deacons',
  // Independent
  'Notre Dame Fighting Irish',
]);

function teamShortName(fullName) {
  // Strip mascot, keep city/school name for display
  const parts = fullName.split(' ');
  if (parts.length <= 2) return fullName;
  // Return last 2 words as short name
  return parts.slice(-2).join(' ');
}

function isAllowedCFB(homeTeam, awayTeam) {
  // Check if either team name contains any allowed team keyword
  for (const team of ALLOWED_CFB_TEAMS) {
    if (homeTeam.includes(team.split(' ')[0]) || awayTeam.includes(team.split(' ')[0])) {
      // Both teams must be power 4
      let homeOk = false, awayOk = false;
      for (const t of ALLOWED_CFB_TEAMS) {
        if (homeTeam.includes(t.split(' ')[0])) homeOk = true;
        if (awayTeam.includes(t.split(' ')[0])) awayOk = true;
      }
      return homeOk && awayOk;
    }
  }
  return false;
}

function getCFBConference(teamName) {
  const bigTen = ['Illinois','Indiana','Iowa','Maryland','Michigan','Minnesota','Nebraska','Northwestern','Ohio State','Penn State','Purdue','Rutgers','UCLA','USC','Washington','Wisconsin','Oregon'];
  const sec = ['Alabama','Arkansas','Auburn','Florida','Georgia','Kentucky','LSU','Mississippi State','Missouri','Ole Miss','South Carolina','Tennessee','Texas A&M','Vanderbilt','Oklahoma','Texas Longhorns'];
  const big12 = ['Arizona','Arizona State','Baylor','BYU','Cincinnati','Colorado','Houston','Iowa State','Kansas','Kansas State','Oklahoma State','TCU','Texas Tech','UCF','Utah','West Virginia'];
  const acc = ['Boston College','California','Clemson','Duke','Florida State','Georgia Tech','Louisville','Miami','NC State','North Carolina','Pittsburgh','SMU','Stanford','Syracuse','Virginia','Virginia Tech','Wake Forest'];

  if (bigTen.some(t => teamName.includes(t))) return 'Big Ten';
  if (sec.some(t => teamName.includes(t))) return 'SEC';
  if (big12.some(t => teamName.includes(t))) return 'Big 12';
  if (acc.some(t => teamName.includes(t))) return 'ACC';
  if (teamName.includes('Notre Dame')) return 'Independent';
  return 'CFB';
}

function parseOddsToGames(oddsData, gameType) {
  const games = [];
  for (const event of oddsData) {
    const dk = event.bookmakers?.find(b => b.key === 'draftkings');
    if (!dk) continue;

    const spreadMarket = dk.markets?.find(m => m.key === 'spreads');
    const totalMarket = dk.markets?.find(m => m.key === 'totals');

    if (!spreadMarket && !totalMarket) continue;

    // For CFB, filter to Power 4 + Notre Dame only
    if (gameType === 'CFB') {
      const homeWords = event.home_team.split(' ');
      const awayWords = event.away_team.split(' ');
      let homeOk = false, awayOk = false;

      for (const allowed of ALLOWED_CFB_TEAMS) {
        const allowedWords = allowed.split(' ');
        if (allowedWords.some(w => homeWords.includes(w))) homeOk = true;
        if (allowedWords.some(w => awayWords.includes(w))) awayOk = true;
      }
      if (!homeOk || !awayOk) continue;
    }

    // Parse spread
    let spreadAway = null, spreadHome = null;
    if (spreadMarket) {
      const awayOutcome = spreadMarket.outcomes.find(o => o.name === event.away_team);
      const homeOutcome = spreadMarket.outcomes.find(o => o.name === event.home_team);
      if (awayOutcome) spreadAway = awayOutcome.point;
      if (homeOutcome) spreadHome = homeOutcome.point;
    }

    // Parse total
    let total = null;
    if (totalMarket) {
      const overOutcome = totalMarket.outcomes.find(o => o.name === 'Over');
      if (overOutcome) total = overOutcome.point;
    }

    // Short display names
    const awayDisplay = event.away_team.replace(' Fighting Illini','').replace(' Crimson Tide','').replace(' Volunteers','').replace(' Commodores','').replace(' Razorbacks','').replace(' Wildcats','').replace(' Hawkeyes','').replace(' Terrapins','').replace(' Wolverines','').replace(' Spartans','').replace(' Golden Gophers','').replace(' Cornhuskers','').replace(' Wildcats','').replace(' Buckeyes','').replace(' Nittany Lions','').replace(' Boilermakers','').replace(' Scarlet Knights','').replace(' Bruins','').replace(' Trojans','').replace(' Huskies','').replace(' Badgers','').replace(' Ducks','').replace(' Bulldogs','').replace(' Bears','').replace(' Cougars','').replace(' Bearcats','').replace(' Buffaloes','').replace(' Cyclones','').replace(' Jayhawks','').replace(' Cowboys','').replace(' Horned Frogs','').replace(' Red Raiders','').replace(' Knights','').replace(' Utes','').replace(' Mountaineers','').replace(' Eagles','').replace(' Golden Bears','').replace(' Tigers','').replace(' Blue Devils','').replace(' Seminoles','').replace(' Yellow Jackets','').replace(' Cardinals','').replace(' Hurricanes','').replace(' Wolfpack','').replace(' Tar Heels','').replace(' Panthers','').replace(' Mustangs','').replace(' Cardinal','').replace(' Orange','').replace(' Cavaliers','').replace(' Hokies','').replace(' Demon Deacons','').replace(' Gators','').replace(' Longhorns','').replace(' Sooners','').replace(' Aggies','').replace(' Tigers','').replace(' Rebels','').replace(' Gamecocks','').replace(' Fighting Irish','');

    const homeDisplay = event.home_team.replace(' Fighting Illini','').replace(' Crimson Tide','').replace(' Volunteers','').replace(' Commodores','').replace(' Razorbacks','').replace(' Wildcats','').replace(' Hawkeyes','').replace(' Terrapins','').replace(' Wolverines','').replace(' Spartans','').replace(' Golden Gophers','').replace(' Cornhuskers','').replace(' Wildcats','').replace(' Buckeyes','').replace(' Nittany Lions','').replace(' Boilermakers','').replace(' Scarlet Knights','').replace(' Bruins','').replace(' Trojans','').replace(' Huskies','').replace(' Badgers','').replace(' Ducks','').replace(' Bulldogs','').replace(' Bears','').replace(' Cougars','').replace(' Bearcats','').replace(' Buffaloes','').replace(' Cyclones','').replace(' Jayhawks','').replace(' Cowboys','').replace(' Horned Frogs','').replace(' Red Raiders','').replace(' Knights','').replace(' Utes','').replace(' Mountaineers','').replace(' Eagles','').replace(' Golden Bears','').replace(' Tigers','').replace(' Blue Devils','').replace(' Seminoles','').replace(' Yellow Jackets','').replace(' Cardinals','').replace(' Hurricanes','').replace(' Wolfpack','').replace(' Tar Heels','').replace(' Panthers','').replace(' Mustangs','').replace(' Cardinal','').replace(' Orange','').replace(' Cavaliers','').replace(' Hokies','').replace(' Demon Deacons','').replace(' Gators','').replace(' Longhorns','').replace(' Sooners','').replace(' Aggies','').replace(' Tigers','').replace(' Rebels','').replace(' Gamecocks','').replace(' Fighting Irish','');

    games.push({
      odds_event_id: event.id,
      game_type: gameType,
      conference: gameType === 'CFB' ? getCFBConference(event.home_team) : 'NFL',
      away_team: awayDisplay.trim(),
      home_team: homeDisplay.trim(),
      game_time: event.commence_time,
      spread_away: spreadAway,
      spread_home: spreadHome,
      total,
    });
  }
  return games;
}

// POST /api/odds/import - admin: pull lines from Odds API and populate games for active week
router.post('/import', authMiddleware, adminMiddleware, async (req, res) => {
  if (!ODDS_API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  const client = await pool.connect();
  try {
    // Get active week
    const { rows: weekRows } = await client.query(`
      SELECT w.* FROM weeks w
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true LIMIT 1
    `);
    if (!weekRows.length) return res.status(404).json({ error: 'No active week found. Create a week first.' });
    const week = weekRows[0];

    // Fetch NFL odds
    const nflRes = await fetch(`${ODDS_BASE}/sports/americanfootball_nfl/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals&bookmakers=draftkings&oddsFormat=american`);
    const nflData = await nflRes.json();
    if (!nflRes.ok) return res.status(500).json({ error: nflData.message || 'NFL odds fetch failed' });

    // Fetch CFB odds
    const cfbRes = await fetch(`${ODDS_BASE}/sports/americanfootball_ncaaf/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals&bookmakers=draftkings&oddsFormat=american`);
    const cfbData = await cfbRes.json();
    if (!cfbRes.ok) return res.status(500).json({ error: cfbData.message || 'CFB odds fetch failed' });

    const nflGames = parseOddsToGames(Array.isArray(nflData) ? nflData : [], 'NFL');
    const cfbGames = parseOddsToGames(Array.isArray(cfbData) ? cfbData : [], 'CFB');
    const allGames = [...cfbGames, ...nflGames];

    await client.query('BEGIN');

    // Delete existing games for this week that haven't been scored yet
    await client.query(`DELETE FROM games WHERE week_id = $1 AND status = 'scheduled'`, [week.id]);

    // Insert new games
    let sortOrder = 1;
    for (const g of allGames) {
      await client.query(`
        INSERT INTO games (week_id, game_type, conference, away_team, home_team, game_time, spread_away, spread_home, total, sort_order, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled')
        ON CONFLICT DO NOTHING
      `, [week.id, g.game_type, g.conference, g.away_team, g.home_team, g.game_time, g.spread_away, g.spread_home, g.total, sortOrder++]);
    }

    await client.query('COMMIT');
    res.json({ success: true, imported: allGames.length, nfl: nflGames.length, cfb: cfbGames.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/odds/scores - fetch and auto-grade live/final scores
router.post('/scores', authMiddleware, adminMiddleware, async (req, res) => {
  if (!ODDS_API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  const client = await pool.connect();
  try {
    const { rows: weekRows } = await client.query(`
      SELECT w.* FROM weeks w
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true LIMIT 1
    `);
    if (!weekRows.length) return res.status(404).json({ error: 'No active week' });
    const week = weekRows[0];

    const { rows: games } = await client.query(
      `SELECT * FROM games WHERE week_id = $1 AND status = 'scheduled'`, [week.id]
    );
    if (!games.length) return res.json({ success: true, graded: 0, message: 'No ungraded games' });

    // Fetch scores for both sports
    const [nflScores, cfbScores] = await Promise.all([
      fetch(`${ODDS_BASE}/sports/americanfootball_nfl/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`).then(r => r.json()),
      fetch(`${ODDS_BASE}/sports/americanfootball_ncaaf/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`).then(r => r.json()),
    ]);

    const allScores = [
      ...(Array.isArray(nflScores) ? nflScores : []),
      ...(Array.isArray(cfbScores) ? cfbScores : []),
    ];

    let graded = 0;
    await client.query('BEGIN');

    for (const game of games) {
      // Match by team name (fuzzy)
      const scoreEvent = allScores.find(s =>
        s.completed &&
        (s.home_team.includes(game.home_team.split(' ')[0]) ||
         game.home_team.includes(s.home_team.split(' ')[0]))
      );

      if (!scoreEvent?.scores) continue;

      const homeScore = scoreEvent.scores.find(s => s.name === scoreEvent.home_team)?.score;
      const awayScore = scoreEvent.scores.find(s => s.name === scoreEvent.away_team)?.score;

      if (homeScore == null || awayScore == null) continue;

      // Update game score
      await client.query(
        `UPDATE games SET home_score=$1, away_score=$2, status='final' WHERE id=$3`,
        [parseInt(homeScore), parseInt(awayScore), game.id]
      );

      // Grade picks
      await gradeGamePicks(client, game, parseInt(awayScore), parseInt(homeScore), week.id);
      graded++;
    }

    await recalcAllWeeklyScores(client, week.id);
    await client.query('COMMIT');
    res.json({ success: true, graded });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/odds/status - check API quota remaining
router.get('/status', authMiddleware, adminMiddleware, async (req, res) => {
  if (!ODDS_API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  try {
    const r = await fetch(`${ODDS_BASE}/sports?apiKey=${ODDS_API_KEY}`);
    res.json({
      requests_used: r.headers.get('x-requests-used'),
      requests_remaining: r.headers.get('x-requests-remaining'),
      requests_last: r.headers.get('x-requests-last'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function gradeGamePicks(client, game, awayScore, homeScore, weekId) {
  const { rows: seasonRows } = await client.query(`
    SELECT s.* FROM seasons s JOIN weeks w ON w.season_id = s.id WHERE w.id = $1
  `, [weekId]);
  const season = seasonRows[0];
  const { rows: gamePicks } = await client.query('SELECT * FROM picks WHERE game_id = $1', [game.id]);

  for (const pick of gamePicks) {
    let result = 'pending', points = 0;
    if (pick.pick_type === 'spread') {
      const margin = awayScore - homeScore;
      const cover = pick.picked_team === game.away_team
        ? margin + parseFloat(game.spread_away)
        : -(margin) + parseFloat(game.spread_home);
      if (cover > 0) { result = 'win'; points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win); }
      else if (cover < 0) { result = 'loss'; points = 0; }
      else { result = 'push'; points = parseFloat(season.point_push); }
    } else {
      const totalScored = awayScore + homeScore;
      const line = parseFloat(game.total);
      const isOver = pick.pick_type === 'over';
      if (totalScored > line) { result = isOver ? 'win' : 'loss'; }
      else if (totalScored < line) { result = isOver ? 'loss' : 'win'; }
      else { result = 'push'; }
      if (result === 'win') points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win);
      else if (result === 'push') points = parseFloat(season.point_push);
    }
    await client.query('UPDATE picks SET result=$1, points_earned=$2 WHERE id=$3', [result, points, pick.id]);
  }
}

async function recalcAllWeeklyScores(client, weekId) {
  const { rows: allPicks } = await client.query(`
    SELECT p.user_id, p.result, p.points_earned, p.is_lock,
           w.id as week_id, w.season_id, w.quarter_id
    FROM picks p JOIN weeks w ON w.id = p.week_id
    WHERE p.week_id = $1 AND p.result IS NOT NULL AND p.result != 'pending'
  `, [weekId]);

  const byUser = {};
  for (const p of allPicks) {
    if (!byUser[p.user_id]) byUser[p.user_id] = {
      user_id: p.user_id, week_id: p.week_id, season_id: p.season_id,
      quarter_id: p.quarter_id, total_points: 0, wins: 0, losses: 0, pushes: 0,
      lock_result: null, lock_points: 0
    };
    const u = byUser[p.user_id];
    u.total_points += parseFloat(p.points_earned || 0);
    if (p.result === 'win') u.wins++;
    else if (p.result === 'loss') u.losses++;
    else if (p.result === 'push' || p.result === 'void') u.pushes++;
    if (p.is_lock) { u.lock_result = p.result; u.lock_points = parseFloat(p.points_earned || 0); }
  }

  for (const u of Object.values(byUser)) {
    await client.query(`
      INSERT INTO weekly_scores (user_id, week_id, season_id, quarter_id, total_points, wins, losses, pushes, lock_result, lock_points)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (user_id, week_id) DO UPDATE SET
        total_points=$5, wins=$6, losses=$7, pushes=$8, lock_result=$9, lock_points=$10
    `, [u.user_id, u.week_id, u.season_id, u.quarter_id, u.total_points,
        u.wins, u.losses, u.pushes, u.lock_result, u.lock_points]);
  }
}

module.exports = router;
module.exports.gradeGamePicks = gradeGamePicks;
module.exports.recalcAllWeeklyScores = recalcAllWeeklyScores;

// POST /api/odds/test-import - admin: import NBA games to test the full pipeline
router.post('/test-import', authMiddleware, adminMiddleware, async (req, res) => {
  if (!ODDS_API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  const client = await pool.connect();
  try {
    const { rows: weekRows } = await client.query(`
      SELECT w.* FROM weeks w
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true LIMIT 1
    `);
    if (!weekRows.length) return res.status(404).json({ error: 'No active week. Create one first.' });
    const week = weekRows[0];

    const nbaRes = await fetch(`${ODDS_BASE}/sports/basketball_nba/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=spreads,totals&bookmakers=draftkings&oddsFormat=american`);
    const nbaData = await nbaRes.json();
    if (!nbaRes.ok) return res.status(500).json({ error: nbaData.message || 'NBA fetch failed' });

    const games = [];
    for (const event of (Array.isArray(nbaData) ? nbaData : [])) {
      const dk = event.bookmakers?.find(b => b.key === 'draftkings');
      if (!dk) continue;
      const spreadMarket = dk.markets?.find(m => m.key === 'spreads');
      const totalMarket = dk.markets?.find(m => m.key === 'totals');
      let spreadAway = null, spreadHome = null, total = null;
      if (spreadMarket) {
        const ao = spreadMarket.outcomes.find(o => o.name === event.away_team);
        const ho = spreadMarket.outcomes.find(o => o.name === event.home_team);
        if (ao) spreadAway = ao.point;
        if (ho) spreadHome = ho.point;
      }
      if (totalMarket) {
        const oo = totalMarket.outcomes.find(o => o.name === 'Over');
        if (oo) total = oo.point;
      }
      games.push({ game_type: 'NFL', conference: 'NBA (Test)', away_team: event.away_team, home_team: event.home_team, game_time: event.commence_time, spread_away: spreadAway, spread_home: spreadHome, total });
    }

    if (!games.length) return res.json({ success: false, message: 'No NBA games with DraftKings lines right now.' });

    await client.query('BEGIN');
    await client.query(`DELETE FROM games WHERE week_id = $1 AND status = 'scheduled'`, [week.id]);
    let sortOrder = 1;
    for (const g of games) {
      await client.query(`
        INSERT INTO games (week_id, game_type, conference, away_team, home_team, game_time, spread_away, spread_home, total, sort_order, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled')
      `, [week.id, g.game_type, g.conference, g.away_team, g.home_team, g.game_time, g.spread_away, g.spread_home, g.total, sortOrder++]);
    }
    await client.query('COMMIT');
    res.json({ success: true, imported: games.length, message: `Imported ${games.length} NBA games. Make picks then use Fetch Scores to auto-grade.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// POST /api/odds/test-scores - fetch NBA scores and grade test picks
router.post('/test-scores', authMiddleware, adminMiddleware, async (req, res) => {
  if (!ODDS_API_KEY) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });
  const client = await pool.connect();
  try {
    const { rows: weekRows } = await client.query(`
      SELECT w.* FROM weeks w JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true LIMIT 1
    `);
    if (!weekRows.length) return res.status(404).json({ error: 'No active week' });
    const week = weekRows[0];

    const { rows: games } = await client.query(
      `SELECT * FROM games WHERE week_id = $1 AND status = 'scheduled' AND conference = 'NBA (Test)'`, [week.id]
    );
    if (!games.length) return res.json({ success: true, graded: 0, message: 'No NBA test games found' });

    const nbaScores = await fetch(`${ODDS_BASE}/sports/basketball_nba/scores?apiKey=${ODDS_API_KEY}&daysFrom=3`).then(r => r.json());
    const allScores = Array.isArray(nbaScores) ? nbaScores : [];

    let graded = 0;
    await client.query('BEGIN');
    for (const game of games) {
      const scoreEvent = allScores.find(s => s.completed && s.scores && s.home_team === game.home_team);
      if (!scoreEvent?.scores) continue;
      const homeScore = scoreEvent.scores.find(s => s.name === scoreEvent.home_team)?.score;
      const awayScore = scoreEvent.scores.find(s => s.name === scoreEvent.away_team)?.score;
      if (homeScore == null || awayScore == null) continue;
      await client.query(`UPDATE games SET home_score=$1, away_score=$2, status='final' WHERE id=$3`, [parseInt(homeScore), parseInt(awayScore), game.id]);
      await gradeGamePicks(client, game, parseInt(awayScore), parseInt(homeScore), week.id);
      graded++;
    }
    await recalcAllWeeklyScores(client, week.id);
    await client.query('COMMIT');
    res.json({ success: true, graded, message: `Graded ${graded} NBA test games` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});
