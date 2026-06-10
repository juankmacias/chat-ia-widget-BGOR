const { handleChat } = require('../../chat-core');
const { json, getClientIp, corsHeaders } = require('./_lib');

exports.handler = async (event) => {
  const cors = corsHeaders();

  // Preflight CORS (cuando el widget se embebe en otro dominio).
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' }, cors);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON inválido' }, cors);
  }

  const userAgent = (event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '')
    .slice(0, 300) || null;
  const ip = getClientIp(event);

  const { status, body } = await handleChat({
    sessionId: payload.sessionId,
    message: payload.message,
    userAgent,
    ip,
  });

  return json(status, body, cors);
};
