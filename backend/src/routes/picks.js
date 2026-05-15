const express = require('express');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/picks/my/:weekId - get my picks for a week
router.get('/my/:weekId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, g.away_team, g.home_team, g.spread_away, g.spread_home,
             g.total, g.game_type, g.conference, g.game_time, g.tv_network,
             g.away_score, g.home_score, g.status as game_status
      FROM picks p
      JOIN games g ON g.id = p.game_id
      WHERE p.user_id = $1 AND p.week_id = $2
      ORDER BY p.submitted_at ASC
    `, [req.user.id, req.params.weekId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/picks/submit - submit all 5 picks for the week
router.post('/submit', authMiddleware, async (req, res) => {
  const { week_id, picks } = req.body;
  // picks = [{ game_id, pick_type, picked_team, is_lock }]

  if (!picks || picks.length !== 5) {
    return res.status(400).json({ error: 'Must submit exactly 5 picks' });
  }
  const lockCount = picks.filter(p => p.is_lock).length;
  if (lockCount !== 1) {
    return res.status(400).json({ error: 'Must designate exactly 1 Lead Pipe Lock' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check deadline
    const { rows: weekRows } = await client.query(
      'SELECT * FROM weeks WHERE id = $1', [week_id]
    );
    const week = weekRows[0];
    if (!week) return res.status(404).json({ error: 'Week not found' });
    if (week.picks_locked || new Date() > new Date(week.submission_deadline)) {
      return res.status(400).json({ error: 'Picks are locked for this week' });
    }

    // Delete existing picks for this week (allow re-submission before deadline)
    await client.query('DELETE FROM picks WHERE user_id=$1 AND week_id=$2', [req.user.id, week_id]);

    for (const pick of picks) {
      await client.query(`
        INSERT INTO picks (user_id, week_id, game_id, pick_type, picked_team, is_lock, result)
        VALUES ($1,$2,$3,$4,$5,$6,'pending')
      `, [req.user.id, week_id, pick.game_id, pick.pick_type, pick.picked_team, pick.is_lock]);
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/picks/dashboard/:weekId - all picks after deadline (for dashboard)
router.get('/dashboard/:weekId', authMiddleware, async (req, res) => {
  try {
    const { rows: weekRows } = await pool.query('SELECT * FROM weeks WHERE id=$1', [req.params.weekId]);
    const week = weekRows[0];
    if (!week) return res.status(404).json({ error: 'Week not found' });

    const isLocked = week.picks_locked || new Date() > new Date(week.submission_deadline);
    if (!isLocked && !req.user.is_admin) {
      return res.json({ locked: true, picks: [] });
    }

    const { rows } = await pool.query(`
      SELECT p.*, u.name as player_name, u.username,
             g.away_team, g.home_team, g.spread_away, g.spread_home,
             g.total, g.game_type, g.conference, g.game_time, g.status as game_status
      FROM picks p
      JOIN users u ON u.id = p.user_id
      JOIN games g ON g.id = p.game_id
      WHERE p.week_id = $1
      ORDER BY g.game_type DESC, g.sort_order ASC, u.name ASC
    `, [req.params.weekId]);

    res.json({ locked: false, picks: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/picks/:pickId/override - admin: override a pick result
router.put('/:pickId/override', authMiddleware, adminMiddleware, async (req, res) => {
  const { result } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: pickRows } = await client.query('SELECT * FROM picks WHERE id=$1', [req.params.pickId]);
    const pick = pickRows[0];
    if (!pick) return res.status(404).json({ error: 'Pick not found' });

    // Get season rules for points calc
    const { rows: seasonRows } = await client.query(`
      SELECT s.* FROM seasons s JOIN weeks w ON w.season_id = s.id WHERE w.id = $1
    `, [pick.week_id]);
    const season = seasonRows[0];

    let points = 0;
    if (result === 'win') points = pick.is_lock ? parseFloat(season.point_lock_win) : parseFloat(season.point_win);
    else if (result === 'push' || result === 'void') points = parseFloat(season.point_push);

    await client.query('UPDATE picks SET result=$1, points_earned=$2 WHERE id=$3', [result, points, req.params.pickId]);

    // Recalc weekly scores
    const { rows: weekRows } = await client.query('SELECT * FROM weeks WHERE id=$1', [pick.week_id]);
    await recalcWeeklyScores(client, pick.week_id);

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

async function recalcWeeklyScores(client, weekId) {
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
