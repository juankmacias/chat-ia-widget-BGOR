const { Pool } = require('pg');
const { MAX_USER_MESSAGES } = require('./config');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en pool de Postgres:', err);
});

async function getOrCreateConversation(sessionId, userAgent, ip) {
  const existing = await pool.query(
    'SELECT id FROM conversations WHERE session_id = $1',
    [sessionId]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), ip = COALESCE(ip, $2) WHERE id = $1',
      [existing.rows[0].id, ip]
    );
    return existing.rows[0].id;
  }
  const created = await pool.query(
    'INSERT INTO conversations (session_id, user_agent, ip) VALUES ($1, $2, $3) RETURNING id',
    [sessionId, userAgent, ip]
  );
  return created.rows[0].id;
}

async function countUserMessagesForSession(sessionId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.session_id = $1 AND m.role = 'user'
       AND m.created_at >= NOW() - INTERVAL '24 hours'`,
    [sessionId]
  );
  return result.rows[0].n;
}

async function countUserMessagesForIp(ip) {
  if (!ip) return 0;
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.ip = $1 AND m.role = 'user'
       AND m.created_at >= NOW() - INTERVAL '24 hours'`,
    [ip]
  );
  return result.rows[0].n;
}

async function getHistory(conversationId, limit = 20) {
  const result = await pool.query(
    `SELECT role, content FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows;
}

async function saveMessage(conversationId, role, content, usage = {}) {
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content, tokens_input, tokens_output)
     VALUES ($1, $2, $3, $4, $5)`,
    [conversationId, role, content, usage.input_tokens ?? null, usage.output_tokens ?? null]
  );
}

async function listConversations(filters = {}) {
  const { limit = 50, offset = 0, from, to, ip, atLimit } = filters;
  const conditions = [];
  const params = [];
  let p = 1;

  if (from) { conditions.push(`c.last_message_at >= $${p++}`); params.push(from); }
  if (to) { conditions.push(`c.last_message_at <= $${p++}`); params.push(to); }
  if (ip) { conditions.push(`c.ip = $${p++}`); params.push(ip); }

  const whereClause = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  let havingClause = '';
  if (atLimit === true) havingClause = `HAVING COUNT(m.id) FILTER (WHERE m.role = 'user') >= ${MAX_USER_MESSAGES}`;
  else if (atLimit === false) havingClause = `HAVING COUNT(m.id) FILTER (WHERE m.role = 'user') < ${MAX_USER_MESSAGES}`;

  const sql = `
    SELECT c.id, c.session_id, c.ip, c.user_agent, c.created_at, c.last_message_at,
           COUNT(m.id)::int AS total_messages,
           COUNT(m.id) FILTER (WHERE m.role = 'user')::int AS user_messages
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    ${whereClause}
    GROUP BY c.id
    ${havingClause}
    ORDER BY c.last_message_at DESC NULLS LAST
    LIMIT $${p++} OFFSET $${p}
  `;
  params.push(limit, offset);
  const result = await pool.query(sql, params);
  return result.rows;
}

async function getConversationMessages(conversationId) {
  const result = await pool.query(
    `SELECT role, content, created_at, tokens_input, tokens_output
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

async function getAdminStats() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM conversations) AS total_conversations,
      (SELECT COUNT(*)::int FROM messages WHERE created_at >= CURRENT_DATE) AS messages_today,
      (SELECT COUNT(*)::int FROM messages) AS total_messages,
      (SELECT COUNT(*)::int FROM conversations c
        WHERE (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user') >= ${MAX_USER_MESSAGES}
      ) AS at_limit_conversations
  `);
  const stats = result.rows[0];
  stats.max_messages = MAX_USER_MESSAGES;
  return stats;
}

module.exports = {
  pool,
  getOrCreateConversation,
  getHistory,
  saveMessage,
  countUserMessagesForSession,
  countUserMessagesForIp,
  listConversations,
  getConversationMessages,
  getAdminStats,
};
