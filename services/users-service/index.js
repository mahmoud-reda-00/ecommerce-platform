const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

let dbReady = false;

async function initDb(retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `);
      dbReady = true;
      console.log('database ready');
      return;
    } catch (err) {
      console.log(`db not ready (attempt ${attempt}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  console.log('could not connect to database, exiting');
  process.exit(1);
}

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'users-service' });
});

app.get('/ready', async (req, res) => {
  if (!dbReady) return res.status(503).json({ status: 'starting' });
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'db unavailable' });
  }
});

app.get('/users', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'id must be a positive integer' });
  }
  try {
    const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'user not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'name and a valid email are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email',
      [name.trim(), email.trim().toLowerCase()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already exists' });
    }
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`users-service listening on port ${PORT}`);
  initDb();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});