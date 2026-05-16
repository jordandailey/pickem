require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, pool } = require('./db');
const { sendToAll } = require('./routes/push');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weeks', require('./routes/weeks'));
app.use('/api/picks', require('./routes/picks'));
app.use('/api/standings', require('./routes/standings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/odds', require('./routes/odds'));
app.use('/api/push', require('./routes/push'));
app.use('/api/profile', require('./routes/profile'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// ============================================
// SCHEDULED JOBS
// ============================================

// Simple scheduler — checks every 15 minutes
function scheduleJobs() {
  setInterval(async () => {
    const now = new Date();
    const hourUTC = now.getUTCHours();
    const minuteUTC = now.getUTCMinutes();
    const dayUTC = now.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat

    // Auto-import odds: every Tuesday at 3pm ET (8pm UTC) and Wednesday at 3pm ET
    // Runs Tue + Wed between 19:50-20:10 UTC
    if ((dayUTC === 2 || dayUTC === 3) && hourUTC === 20 && minuteUTC < 15) {
      await autoImportOdds();
    }

    // Score updates: every 2 hours on Sat (14-23 UTC) and Sun-Mon (13-23 UTC)
    if (
      (dayUTC === 6 && hourUTC >= 14) || // Saturday
      (dayUTC === 0 && hourUTC >= 13) || // Sunday
      (dayUTC === 1 && hourUTC >= 0 && hourUTC <= 3) // Monday night/early
    ) {
      if (minuteUTC < 15) { // Only on the :00 mark each 2hr
        if (hourUTC % 2 === 0) await autoUpdateScores();
      }
    }

    // Push notifications for deadline reminders (ET = UTC-5)
    await checkDeadlineReminders(now);

  }, 15 * 60 * 1000); // Every 15 minutes
}

async function autoImportOdds() {
  if (!process.env.ODDS_API_KEY) return;
  try {
    console.log('🔄 Auto-importing odds...');
    const res = await fetch(`http://localhost:${PORT}/api/odds/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': 'true' }
    });
    const data = await res.json();
    console.log('✅ Auto-import:', data);
  } catch (err) {
    console.error('Auto-import failed:', err.message);
  }
}

async function autoUpdateScores() {
  try {
    console.log('🏈 Checking scores...');
    const res = await fetch(`http://localhost:${PORT}/api/odds/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal': 'true' }
    });
    const data = await res.json();
    if (data.graded > 0) {
      console.log(`✅ Graded ${data.graded} games`);
      await sendToAll('Results are in! 🏈', `${data.graded} games scored — check your picks!`, '/');
    }
  } catch (err) {
    console.error('Score update failed:', err.message);
  }
}

// Internal auth bypass for scheduled jobs
app.use((req, res, next) => {
  if (req.headers['x-internal'] === 'true') {
    req.user = { id: 'system', is_admin: true };
  }
  next();
});

async function checkDeadlineReminders(now) {
  try {
    const { rows: weeks } = await pool.query(`
      SELECT * FROM weeks w
      JOIN seasons s ON s.id = w.season_id AND s.is_active = true
      WHERE w.is_active = true AND w.picks_locked = false
      AND w.submission_deadline > NOW()
      LIMIT 1
    `);
    if (!weeks.length) return;
    const week = weeks[0];
    const deadline = new Date(week.submission_deadline);
    const diffMs = deadline - now;
    const diffMins = Math.floor(diffMs / 60000);

    // 4 hours = 240 min, 2 hours = 120 min, 30 min
    const triggers = [
      { mins: 240, label: '4 hours', emoji: '⏰' },
      { mins: 120, label: '2 hours', emoji: '⚡' },
      { mins: 30, label: '30 minutes', emoji: '🚨' },
    ];

    for (const t of triggers) {
      // Fire if within 15-min window of the trigger
      if (diffMins >= t.mins - 7 && diffMins <= t.mins + 7) {
        // Check we haven't sent this already (use a simple flag in DB)
        const flagKey = `reminder_${week.id}_${t.mins}`;
        const { rows: flagRows } = await pool.query(
          'SELECT 1 FROM notification_flags WHERE flag_key = $1', [flagKey]
        );
        if (!flagRows.length) {
          await sendToAll(
            `${t.emoji} Picks due in ${t.label}!`,
            `Don't forget to submit your Week ${week.nfl_week} picks before ${deadline.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`,
            '/'
          );
          await pool.query('INSERT INTO notification_flags (flag_key) VALUES ($1) ON CONFLICT DO NOTHING', [flagKey]);
          console.log(`📣 Sent ${t.label} reminder`);
        }
      }
    }
  } catch (err) {
    console.error('Reminder check failed:', err.message);
  }
}

// Start
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🏈 Pick'em API running on port ${PORT}`);
    scheduleJobs();
    console.log('⏰ Scheduled jobs started');
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
