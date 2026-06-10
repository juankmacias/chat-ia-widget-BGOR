// Lógica central del chat, compartida por server.js (local) y
// netlify/functions/chat.js (producción). Mantener una sola fuente de verdad
// evita que las dos rutas se desincronicen.
const Anthropic = require('@anthropic-ai/sdk');
const {
  getOrCreateConversation,
  getHistory,
  saveMessage,
  countUserMessagesForSession,
  countUserMessagesForIp,
} = require('./db');
const { SYSTEM_PROMPT } = require('./system-prompt');
const { MAX_USER_MESSAGES } = require('./config');
const { buildContext } = require('./knowledge');

const WHATSAPP = '573209216434';
const LIMIT_REPLY =
  `Llegamos al límite de mensajes por aquí 🙏. Para seguir tu consulta y atenderte personalmente, escríbeme directamente al WhatsApp ${WHATSAPP} y te atiendo de una 😊.`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Procesa un turno de chat completo. Recibe los datos ya extraídos del request
// (sessionId, message, userAgent, ip) y devuelve siempre { status, body } para
// que cada adaptador (Express / Netlify) sólo tenga que serializar la respuesta.
async function handleChat({ sessionId, message, userAgent, ip }) {
  if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 100) {
    return { status: 400, body: { error: 'sessionId inválido' } };
  }
  if (!message || typeof message !== 'string') {
    return { status: 400, body: { error: 'message requerido' } };
  }
  if (message.length > 2000) {
    return { status: 400, body: { error: 'Mensaje demasiado largo (máx 2000)' } };
  }

  try {
    const conversationId = await getOrCreateConversation(sessionId, userAgent, ip);

    const [countBySession, countByIp] = await Promise.all([
      countUserMessagesForSession(sessionId),
      countUserMessagesForIp(ip),
    ]);
    if (countBySession >= MAX_USER_MESSAGES || countByIp >= MAX_USER_MESSAGES) {
      await saveMessage(conversationId, 'user', message);
      await saveMessage(conversationId, 'assistant', LIMIT_REPLY);
      return { status: 200, body: { reply: LIMIT_REPLY, limit_reached: true } };
    }

    const history = await getHistory(conversationId, 20);
    const apiMessages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    await saveMessage(conversationId, 'user', message);

    // Recupera contexto técnico relevante de la biblioteca y lo añade como
    // bloque de sistema dinámico (el prompt base se mantiene cacheado).
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

    // Detecta el marcador [[expert]] (perfil técnico). Lo quita del texto visible
    // y lo señala al frontend para que abra la zona experta (/experto).
    const expertDetected = /\[\[expert\]\]/i.test(rawReply);
    const reply = rawReply.replace(/\[\[expert\]\]/gi, '').replace(/\s+$/g, '').trim();

    await saveMessage(conversationId, 'assistant', reply, response.usage);

    return { status: 200, body: { reply, redirectExpert: expertDetected } };
  } catch (err) {
    console.error('Error en handleChat:', err);
    if (err instanceof Anthropic.APIError) {
      return {
        status: err.status || 500,
        body: { error: 'Error consultando la IA', detail: err.message },
      };
    }
    return { status: 500, body: { error: 'Error interno', detail: err.message } };
  }
}

module.exports = { handleChat, LIMIT_REPLY, WHATSAPP };
