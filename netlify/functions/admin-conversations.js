const { listConversations } = require('../../db');
const { json, checkAdminAuth } = require('./_lib');

exports.handler = async (event) => {
  const authError = checkAdminAuth(event);
  if (authError) return authError;

  try {
    const q = event.queryStringParameters || {};
    const rows = await listConversations({
      limit: q.limit ? Math.min(parseInt(q.limit, 10), 200) : 50,
      offset: q.offset ? parseInt(q.offset, 10) : 0,
      from: q.from || undefined,
      to: q.to || undefined,
      ip: q.ip || undefined,
      atLimit: q.at_limit === 'true' ? true : q.at_limit === 'false' ? false : undefined,
    });
    return json(200, rows);
  } catch (err) {
    console.error('Error en admin-conversations:', err);
    return json(500, { error: 'Error', detail: err.message });
  }
};
