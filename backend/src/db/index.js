const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  const client = await pool.connect();
  try {
    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);

    // Hash and set passwords for seeded users
    const players = [
      { username: 'dans',   password: 'dans' },
      { username: 'jack',   password: 'jack' },
      { username: 'tony2',  password: 'tony2' },
      { username: 'richk',  password: 'richk' },
      { username: 'luke',   password: 'luke' },
      { username: 'steves', password: 'steves' },
      { username: 'tony',   password: 'tony' },
      { username: 'dand',   password: 'dand' },
      { username: 'davei',  password: 'davei' },
      { username: 'jordan', password: 'jordan' },
      { username: 'scott',  password: 'scott' },
      { username: 'sebby',  password: 'sebby' },
      { username: 'troy',   password: 'troy' },
      { username: 'joejr',  password: 'joejr' },
      { username: 'peteri', password: 'peteri' },
      { username: 'verdi',  password: 'verdi' },
      { username: 'joeyi',  password: 'joeyi' },
    ];

    for (const p of players) {
      const hash = await bcrypt.hash(p.password, 10);
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE username = $2 AND password_hash = ''`,
        [hash, p.username]
      );
      // Also handle first insert where password_hash column may be empty
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE username = $2 AND (password_hash IS NULL OR password_hash = '')`,
        [hash, p.username]
      );
    }
    console.log('✅ Database initialized');
  } catch (err) {
    // Schema already exists - that's fine on restarts
    if (!err.message.includes('already exists')) {
      console.error('DB init error:', err.message);
    } else {
      console.log('✅ Database already initialized');
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
