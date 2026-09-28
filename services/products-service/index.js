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
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
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
  res.status(200).json({ status: 'ok', service: 'products-service' });
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

app.get('/products', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, price FROM products ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/products', async (req, res) => {
  const { name, price } = req.body;
  if (!name || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'name (string) and price (number >= 0) are required' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING id, name, price',
      [name, price]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`products-service listening on port ${PORT}`);
  initDb();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});