const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/players
router.get('/players', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, is_admin, created_at FROM users ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/players - add new player
router.post('/players', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, username, password, is_admin } = req.body;
  try {
    const hash = await bcrypt.hash(password || username, 10);
    const { rows } = await pool.query(`
      INSERT INTO users (name, username, password_hash, is_admin)
      VALUES ($1,$2,$3,$4) RETURNING id, name, username, is_admin
    `, [name, username.toLowerCase(), hash, is_admin || false]);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/players/:id/reset-password
router.put('/players/:id/reset-password', authMiddleware, adminMiddleware, async (req, res) => {
  const { password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/players/:id
router.delete('/players/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1 AND is_admin=false', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/season - get active season settings
router.get('/season', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM seasons WHERE is_active=true LIMIT 1');
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/season - update season settings
router.put('/season', authMiddleware, adminMiddleware, async (req, res) => {
  const { entry_fee, grand_prize, second_prize, quarterly_prize,
          point_win, point_lock_win, point_push, picks_per_week } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE seasons SET
        entry_fee=$1, grand_prize=$2, second_prize=$3, quarterly_prize=$4,
        point_win=$5, point_lock_win=$6, point_push=$7, picks_per_week=$8
      WHERE is_active=true RETURNING *
    `, [entry_fee, grand_prize, second_prize, quarterly_prize,
        point_win, point_lock_win, point_push, picks_per_week]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/weeks - list all weeks with stats
router.get('/weeks', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT w.*, q.quarter_number,
        COUNT(DISTINCT g.id) as game_count,
        COUNT(DISTINCT p.user_id) as submitters
      FROM weeks w
      LEFT JOIN quarters q ON q.id = w.quarter_id
      LEFT JOIN games g ON g.week_id = w.id
      LEFT JOIN picks p ON p.week_id = w.id
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      GROUP BY w.id, q.quarter_number
      ORDER BY w.nfl_week ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/weeks/:id/activate - set a week as active
router.put('/weeks/:id/activate', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: wRows } = await client.query('SELECT season_id FROM weeks WHERE id=$1', [req.params.id]);
    await client.query('UPDATE weeks SET is_active=false WHERE season_id=$1', [wRows[0].season_id]);
    await client.query('UPDATE weeks SET is_active=true WHERE id=$1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
