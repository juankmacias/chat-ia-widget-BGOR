const { getConversationMessages } = require('../../db');
const { json, checkAdminAuth } = require('./_lib');

exports.handler = async (event) => {
  const authError = checkAdminAuth(event);
  if (authError) return authError;

  const id = event.queryStringParameters?.id;
  if (!id) return json(400, { error: 'id requerido' });

  try {
    const messages = await getConversationMessages(id);
    return json(200, messages);
  } catch (err) {
    console.error('Error en admin-messages:', err);
    return json(500, { error: 'Error', detail: err.message });
  }
};
