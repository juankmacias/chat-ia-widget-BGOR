// Tests de validación de entrada de handleChat.
// La validación ocurre ANTES de tocar la base de datos o la API de Anthropic
// (devuelve temprano), así que estos casos corren sin red ni DATABASE_URL.
const test = require('node:test');
const assert = require('node:assert/strict');

const { handleChat } = require('../chat-core');

test('rechaza sessionId ausente', async () => {
  const { status, body } = await handleChat({ message: 'hola' });
  assert.equal(status, 400);
  assert.match(body.error, /sessionId/i);
});

test('rechaza sessionId no-string', async () => {
  const { status } = await handleChat({ sessionId: 123, message: 'hola' });
  assert.equal(status, 400);
});

test('rechaza sessionId demasiado largo', async () => {
  const { status } = await handleChat({ sessionId: 'x'.repeat(101), message: 'hola' });
  assert.equal(status, 400);
});

test('rechaza message ausente', async () => {
  const { status, body } = await handleChat({ sessionId: 'sess_1' });
  assert.equal(status, 400);
  assert.match(body.error, /message/i);
});

test('rechaza message demasiado largo', async () => {
  const { status, body } = await handleChat({
    sessionId: 'sess_1',
    message: 'a'.repeat(2001),
  });
  assert.equal(status, 400);
  assert.match(body.error, /largo/i);
});
