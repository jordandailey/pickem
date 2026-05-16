const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const webpush = require('web-push');

const router = express.Router();

// Configure web push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'admin@pickem.app'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// GET /api/push/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// POST /api/push/subscribe - save push subscription for user
router.post('/subscribe', authMiddleware, async (req, res) => {
  const { subscription } = req.body;
  try {
    await pool.query(`
      INSERT INTO push_subscriptions (user_id, subscription)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET subscription = $2, updated_at = NOW()
    `, [req.user.id, JSON.stringify(subscription)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send notification to all subscribers (internal use)
async function sendToAll(title, body, url = '/') {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const { rows } = await pool.query('SELECT * FROM push_subscriptions');
    const payload = JSON.stringify({ title, body, url });
    const results = await Promise.allSettled(
      rows.map(row => webpush.sendNotification(JSON.parse(row.subscription), payload))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      // Clean up invalid subscriptions
      console.log(`${failed} push notifications failed`);
    }
    return results.filter(r => r.status === 'fulfilled').length;
  } catch (err) {
    console.error('Push error:', err.message);
  }
}

// Send to a specific user
async function sendToUser(userId, title, body, url = '/') {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  try {
    const { rows } = await pool.query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
    if (!rows.length) return;
    const payload = JSON.stringify({ title, body, url });
    await webpush.sendNotification(JSON.parse(rows[0].subscription), payload);
  } catch (err) {
    console.error('Push error for user:', err.message);
  }
}

module.exports = router;
module.exports.sendToAll = sendToAll;
module.exports.sendToUser = sendToUser;
