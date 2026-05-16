const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/profile - get my profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, username, is_admin, avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/profile/password - change password
router.put('/password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/profile/avatar - upload avatar (base64)
router.post('/avatar', authMiddleware, async (req, res) => {
  const { avatar_url } = req.body;
  try {
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, req.user.id]);
    res.json({ success: true, avatar_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
