const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');

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

const productsClient = axios.create({
  baseURL: process.env.PRODUCTS_SERVICE_URL,
  timeout: 3000,
});
const usersClient = axios.create({
  baseURL: process.env.USERS_SERVICE_URL,
  timeout: 3000,
});

let dbReady = false;

async function initDb(retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL CHECK (quantity > 0),
          status TEXT NOT NULL DEFAULT 'pending',
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
  res.status(200).json({ status: 'ok', service: 'orders-service' });
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

app.get('/orders', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.post('/orders', async (req, res) => {
  const { user_id, product_id, quantity } = req.body;

  if (![user_id, product_id, quantity].every((v) => Number.isInteger(v)) || quantity < 1) {
    return res.status(400).json({ error: 'user_id, product_id, quantity (positive integers) are required' });
  }

  // Verify the user exists
  try {
    await usersClient.get(`/users/${user_id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(400).json({ error: `user ${user_id} does not exist` });
    }
    console.error('users-service call failed:', err.message);
    return res.status(502).json({ error: 'could not verify user, try again later' });
  }

   // Verify the product exists
  try {
    await productsClient.get(`/products/${product_id}`);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(400).json({ error: `product ${product_id} does not exist` });
    }
    console.error('products-service call failed:', err.message);
    return res.status(502).json({ error: 'could not verify product, try again later' });
  }
  
  try {
    const { rows } = await pool.query(
      'INSERT INTO orders (user_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
      [user_id, product_id, quantity]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`orders-service listening on port ${PORT}`);
  initDb();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});