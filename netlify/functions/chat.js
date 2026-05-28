const Anthropic = require('@anthropic-ai/sdk');
const {
  getOrCreateConversation,
  getHistory,
  saveMessage,
  countUserMessagesForSession,
  countUserMessagesForIp,
} = require('../../db');
const { SYSTEM_PROMPT } = require('../../system-prompt');
const { MAX_USER_MESSAGES } = require('../../config');
const { buildContext } = require('../../knowledge');
const { json, getClientIp } = require('./_lib');

const LIMIT_REPLY =
  'Llegamos al límite de mensajes por aquí 🙏. Para seguir tu consulta y atenderte personalmente, escríbeme directamente al WhatsApp 322 3671553 y te atiendo de una 😊.';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const { sessionId, message } = payload;
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    return json(400, { error: 'sessionId inválido' });
  }
  if (!message || typeof message !== 'string') {
    return json(400, { error: 'message requerido' });
  }
  if (message.length > 2000) {
    return json(400, { error: 'Mensaje demasiado largo (máx 2000)' });
  }

  try {
    const userAgent = (event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '')
      .slice(0, 300) || null;
    const ip = getClientIp(event);
    const conversationId = await getOrCreateConversation(sessionId, userAgent, ip);

    const [countBySession, countByIp] = await Promise.all([
      countUserMessagesForSession(sessionId),
      countUserMessagesForIp(ip),
    ]);
    if (countBySession >= MAX_USER_MESSAGES || countByIp >= MAX_USER_MESSAGES) {
      await saveMessage(conversationId, 'user', message);
      await saveMessage(conversationId, 'assistant', LIMIT_REPLY);
      return json(200, { reply: LIMIT_REPLY, limit_reached: true });
    }

    const history = await getHistory(conversationId, 20);
    const apiMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    await saveMessage(conversationId, 'user', message);

    const lastUser = history.filter((m) => m.role === 'user').slice(-1)[0];
    const knowledgeQuery = lastUser ? `${lastUser.content}\n${message}` : message;
    const knowledgeContext = buildContext(knowledgeQuery);

    const system = [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }];
    if (knowledgeContext) system.push({ type: 'text', text: knowledgeContext });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: apiMessages,
    });

    const rawReply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const expertDetected = /\[\[expert\]\]/i.test(rawReply);
    const reply = rawReply.replace(/\[\[expert\]\]/gi, '').replace(/\s+$/g, '').trim();

    await saveMessage(conversationId, 'assistant', reply, response.usage);

    return json(200, { reply, redirectExpert: expertDetected });
  } catch (err) {
    console.error('Error en chat function:', err);
    if (err instanceof Anthropic.APIError) {
      return json(err.status || 500, {
        error: 'Error consultando la IA',
        detail: err.message,
      });
    }
    return json(500, { error: 'Error interno', detail: err.message });
  }
};
