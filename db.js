const { Pool } = require('pg');

// Database connection configuration
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'puzzle_db',
  user: 'puzzle_user',
  password: 'puzzle_password',
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    // Only log query details in debug mode (comment out for production)
    // console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

// Get all words that need Korean meanings
async function getWordsWithoutKoreanMeaning(language = 'en') {
  const queryText = `
    SELECT id, word, language 
    FROM dictionary_multi 
    WHERE language = $1 
      AND (meaning_ko IS NULL OR meaning_ko = 'null'::jsonb)
      AND word IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 100
  `;
  const result = await query(queryText, [language]);
  return result.rows;
}

// Update Korean meaning for a word
async function updateKoreanMeaning(id, language, meaningKo) {
  const queryText = `
    UPDATE dictionary_multi 
    SET meaning_ko = $1::jsonb, updated_at = NOW()
    WHERE id = $2 AND language = $3
  `;
  // pg library automatically converts JavaScript objects to JSONB
  await query(queryText, [meaningKo, id, language]);
}

// Close the connection pool
async function close() {
  if (pool.ended) {
    return; // Already closed
  }
  await pool.end();
}

module.exports = {
  pool,
  query,
  getWordsWithoutKoreanMeaning,
  updateKoreanMeaning,
  close,
};

