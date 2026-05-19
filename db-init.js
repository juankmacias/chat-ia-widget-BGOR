require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Ejecutando schema.sql en Neon...');
  await pool.query(sql);
  console.log('Tablas creadas correctamente.');
  await pool.end();
}

init().catch((err) => {
  console.error('Error inicializando la base de datos:', err.message);
  process.exit(1);
});
