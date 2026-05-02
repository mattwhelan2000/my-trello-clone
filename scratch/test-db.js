const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL + "?sslmode=require";
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  console.log('Testing connection (with SSL) to:', connectionString.replace(/:[^:]+@/, ':****@').split('@')[1]);
  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database!');
    const res = await client.query('SELECT NOW()');
    console.log('Query result:', res.rows[0]);
    client.release();
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();
