// Tests del recuperador de conocimiento (BM25 + sinónimos).
// Usa el runner integrado de Node (node:test) — sin dependencias extra.
const test = require('node:test');
const assert = require('node:assert/strict');

const { retrieve, buildContext, expandQueryTerms } = require('../knowledge');

test('expandQueryTerms agrega sinónimos del dominio', () => {
  const out = expandQueryTerms(['vaca']);
  assert.ok(out.includes('vaca'), 'conserva el término original');
  assert.ok(out.includes('bovino'), 'expande vaca -> bovino');
  assert.ok(out.includes('rumiante'), 'expande vaca -> rumiante');
});

test('expandQueryTerms no inventa sinónimos para términos desconocidos', () => {
  const out = expandQueryTerms(['xyzzy']);
  assert.deepEqual(out, ['xyzzy']);
});

test('expandQueryTerms no duplica términos', () => {
  const out = expandQueryTerms(['vaca', 'bovino']);
  const unique = new Set(out);
  assert.equal(out.length, unique.size);
});

test('retrieve devuelve pasajes ordenados por score descendente', () => {
  const hits = retrieve('dosificación del producto para bovinos', 5);
  assert.ok(Array.isArray(hits));
  if (hits.length > 1) {
    for (let i = 1; i < hits.length; i++) {
      assert.ok(hits[i - 1].score >= hits[i].score, 'score no creciente');
    }
  }
});

test('retrieve con consulta vacía devuelve []', () => {
  assert.deepEqual(retrieve('', 5), []);
  assert.deepEqual(retrieve('   ', 5), []);
});

test('buildContext devuelve string (vacío o con encabezado de referencia)', () => {
  const ctx = buildContext('beneficios para rumiantes');
  assert.equal(typeof ctx, 'string');
  if (ctx) {
    assert.ok(ctx.includes('CONOCIMIENTO TÉCNICO DE REFERENCIA'));
  }
});

test('buildContext respeta el límite de caracteres', () => {
  const ctx = buildContext('producto bovino equino porcino ave', { maxChars: 1500 });
  // Permitimos algo de margen por el encabezado fijo.
  assert.ok(ctx.length <= 1500 + 600, `contexto demasiado largo: ${ctx.length}`);
});
