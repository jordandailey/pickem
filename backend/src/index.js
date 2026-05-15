require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/weeks', require('./routes/weeks'));
app.use('/api/picks', require('./routes/picks'));
app.use('/api/standings', require('./routes/standings'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Start
initDb().then(() => {
  app.listen(PORT, () => console.log(`🏈 Pick'em API running on port ${PORT}`));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
