const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/weeks - get all weeks for active season
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT w.*, q.quarter_number, q.name as quarter_name
      FROM weeks w
      LEFT JOIN quarters q ON q.id = w.quarter_id
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      ORDER BY w.nfl_week ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weeks/active - get current active week with games
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const { rows: weekRows } = await pool.query(`
      SELECT w.*, q.quarter_number, q.name as quarter_name
      FROM weeks w
      LEFT JOIN quarters q ON q.id = w.quarter_id
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true
      LIMIT 1
    `);
    if (!weekRows.length) return res.json(null);
    const week = weekRows[0];

    const { rows: games } = await pool.query(`
      SELECT * FROM games WHERE week_id = $1 ORDER BY game_type DESC, sort_order ASC, game_time ASC
    `, [week.id]);

    res.json({ ...week, games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/weeks/:id - get specific week with games
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { rows: weekRows } = await pool.query(`
      SELECT w.*, q.quarter_number, q.name as quarter_name
      FROM weeks w LEFT JOIN quarters q ON q.id = w.quarter_id
      WHERE w.id = $1
    `, [req.params.id]);
    if (!weekRows.length) return res.status(404).json({ error: 'Week not found' });

    const { rows: games } = await pool.query(`
      SELECT * FROM games WHERE week_id = $1 ORDER BY game_type DESC, sort_order ASC, game_time ASC
    `, [req.params.id]);

    res.json({ ...weekRows[0], games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weeks - admin: create a week
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { nfl_week, cfb_week, label, submission_deadline, quarter_id } = req.body;
  try {
    const { rows: seasons } = await pool.query('SELECT id FROM seasons WHERE is_active = true LIMIT 1');
    const season_id = seasons[0].id;

    // Deactivate current active week first
    await pool.query('UPDATE weeks SET is_active = false WHERE season_id = $1', [season_id]);

    const { rows } = await pool.query(`
      INSERT INTO weeks (season_id, quarter_id, nfl_week, cfb_week, label, submission_deadline, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *
    `, [season_id, quarter_id, nfl_week, cfb_week, label, submission_deadline]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/weeks/:id/games - admin: add game to week
router.post('/:id/games', authMiddleware, adminMiddleware, async (req, res) => {
  const { game_type, conference, away_team, home_team, away_record, home_record,
          game_time, tv_network, spread_away, spread_home, total, sort_order } = req.body;
  try {
    const { rows } = await pool.query(`
      INSERT INTO games (week_id, game_type, conference, away_team, home_team, away_record,
        home_record, game_time, tv_network, spread_away, spread_home, total, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [req.params.id, game_type, conference, away_team, home_team, away_record,
        home_record, game_time, tv_network, spread_away, spread_home, total, sort_order || 0]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/weeks/:weekId/games/:gameId/score - admin: enter final score & auto-grade
router.put('/:weekId/games/:gameId/score', authMiddleware, adminMiddleware, async (req, res) => {
  const { away_score, home_score, status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      UPDATE games SET away_score=$1, home_score=$2, status=$3 WHERE id=$4
    `, [away_score, home_score, status || 'final', req.params.gameId]);

    const { rows: gameRows } = await client.query('SELECT * FROM games WHERE id=$1', [req.params.gameId]);
    const game = gameRows[0];

    // Get season scoring rules
    const { rows: seasonRows } = await client.query(`
      SELECT s.* FROM seasons s
      JOIN weeks w ON w.season_id = s.id
      WHERE w.id = $1
    `, [req.params.weekId]);
    const season = seasonRows[0];

    // Grade all picks for this game
    const { rows: gamePicks } = await client.query(
      'SELECT * FROM picks WHERE game_id = $1', [req.params.gameId]
    );

    for (const pick of gamePicks) {
      let result = 'pending';
      let points = 0;

      if (status === 'cancelled' || status === 'postponed') {
        result = 'void';
        points = parseFloat(season.point_push);
      } else if (pick.pick_type === 'spread') {
        const margin = away_score - home_score;
        const cover = pick.picked_team === game.away_team
          ? margin + parseFloat(game.spread_away)
          : -(margin) + parseFloat(game.spread_home);

        if (cover > 0) { result = 'win'; points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win); }
        else if (cover < 0) { result = 'loss'; points = 0; }
        else { result = 'push'; points = parseFloat(season.point_push); }
      } else {
        // over/under
        const total_scored = away_score + home_score;
        const line = parseFloat(game.total);
        if (pick.pick_type === 'over') {
          if (total_scored > line) { result = 'win'; points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win); }
          else if (total_scored < line) { result = 'loss'; points = 0; }
          else { result = 'push'; points = parseFloat(season.point_push); }
        } else {
          if (total_scored < line) { result = 'win'; points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win); }
          else if (total_scored > line) { result = 'loss'; points = 0; }
          else { result = 'push'; points = parseFloat(season.point_push); }
        }
      }

      await client.query(
        'UPDATE picks SET result=$1, points_earned=$2 WHERE id=$3',
        [result, points, pick.id]
      );
    }

    // Recalculate weekly_scores for all affected users
    await recalcWeeklyScores(client, req.params.weekId);

    await client.query('COMMIT');
    res.json({ success: true, graded: gamePicks.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/weeks/:weekId/games/:gameId - admin: remove game
router.delete('/:weekId/games/:gameId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM games WHERE id=$1 AND week_id=$2', [req.params.gameId, req.params.weekId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/weeks/:weekId/lock - admin: lock/unlock picks
router.put('/:weekId/lock', authMiddleware, adminMiddleware, async (req, res) => {
  const { picks_locked } = req.body;
  try {
    await pool.query('UPDATE weeks SET picks_locked=$1 WHERE id=$2', [picks_locked, req.params.weekId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function recalcWeeklyScores(client, weekId) {
  const { rows: allPicks } = await client.query(`
    SELECT p.user_id, p.result, p.points_earned, p.is_lock,
           w.id as week_id, w.season_id, w.quarter_id
    FROM picks p
    JOIN weeks w ON w.id = p.week_id
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
    u.total_points += parseFloat(p.points_earned);
    if (p.result === 'win') u.wins++;
    else if (p.result === 'loss') u.losses++;
    else if (p.result === 'push' || p.result === 'void') u.pushes++;
    if (p.is_lock) { u.lock_result = p.result; u.lock_points = parseFloat(p.points_earned); }
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
