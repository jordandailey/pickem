const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/standings/overall - full season standings
router.get('/overall', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.username,
        COALESCE(SUM(ws.total_points), 0) as total_points,
        COALESCE(SUM(ws.wins), 0) as wins,
        COALESCE(SUM(ws.losses), 0) as losses,
        COALESCE(SUM(ws.pushes), 0) as pushes,
        COALESCE(SUM(CASE WHEN ws.lock_result = 'win' THEN 1 ELSE 0 END), 0) as lock_wins,
        COALESCE(SUM(CASE WHEN ws.lock_result = 'loss' THEN 1 ELSE 0 END), 0) as lock_losses,
        COALESCE(SUM(CASE WHEN ws.lock_result = 'push' THEN 1 ELSE 0 END), 0) as lock_pushes,
        COALESCE(SUM(ws.lock_points), 0) as lock_points
      FROM users u
      LEFT JOIN weekly_scores ws ON ws.user_id = u.id
      LEFT JOIN seasons s ON s.id = ws.season_id AND s.is_active = true
      WHERE u.is_admin = false
      GROUP BY u.id, u.name, u.username
      ORDER BY total_points DESC, lock_points DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/standings/quarter/:number - quarterly standings
router.get('/quarter/:number', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, u.username,
        COALESCE(SUM(ws.total_points), 0) as total_points,
        COALESCE(SUM(ws.wins), 0) as wins,
        COALESCE(SUM(ws.losses), 0) as losses,
        COALESCE(SUM(ws.pushes), 0) as pushes,
        COALESCE(SUM(CASE WHEN ws.lock_result = 'win' THEN 1 ELSE 0 END), 0) as lock_wins,
        COALESCE(SUM(CASE WHEN ws.lock_result = 'loss' THEN 1 ELSE 0 END), 0) as lock_losses,
        COALESCE(SUM(ws.lock_points), 0) as lock_points
      FROM users u
      LEFT JOIN weekly_scores ws ON ws.user_id = u.id
      LEFT JOIN quarters q ON q.id = ws.quarter_id AND q.quarter_number = $1
      LEFT JOIN seasons s ON s.id = ws.season_id AND s.is_active = true
      WHERE u.is_admin = false AND ws.quarter_id IS NOT NULL
      GROUP BY u.id, u.name, u.username
      ORDER BY total_points DESC, lock_points DESC
    `, [req.params.number]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/standings/week/:weekId - weekly standings
router.get('/week/:weekId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.username,
        COALESCE(ws.total_points, 0) as total_points,
        COALESCE(ws.wins, 0) as wins,
        COALESCE(ws.losses, 0) as losses,
        COALESCE(ws.pushes, 0) as pushes,
        ws.lock_result, ws.lock_points
      FROM users u
      LEFT JOIN weekly_scores ws ON ws.user_id = u.id AND ws.week_id = $1
      WHERE u.is_admin = false
      ORDER BY total_points DESC, lock_points DESC
    `, [req.params.weekId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
