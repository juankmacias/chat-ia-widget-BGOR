// Recuperación de conocimiento (RAG ligero) para el asesor experto B-GOR.
// Carga los pasajes generados por scripts/build-knowledge.js y, dada una consulta,
// devuelve los más relevantes con un ranking BM25 — sin dependencias externas.
const fs = require('fs');
const path = require('path');

const CHUNKS_PATH = path.join(__dirname, 'knowledge', 'chunks.json');

// Stopwords en español (las más frecuentes) para no rankear por palabras vacías.
const STOPWORDS = new Set(
  ('de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto mi antes algunos que unos yo otro otras otra el tanto esa estos mucho quienes nada muchos cual poco ella estar estas algunas algo nosotros mi mis tu te ti tu tus ellas nosotras vosotros vosotras os mio mia mios mias tuyo tuya suyo suya nuestro nuestra vuestro vuestra esos esas estoy esta es son ser fue ha han hace puede debe sus o u del al lo')
    .split(/\s+/)
);

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

let CHUNKS = [];
let TF = []; // term-frequency por chunk
let DF = new Map(); // document frequency por término
let AVGDL = 0;
let LOADED = false;

function load() {
  if (LOADED) return;
  LOADED = true;
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.warn('[knowledge] No existe knowledge/chunks.json — ejecuta: npm run kb:build');
    return;
  }
  CHUNKS = JSON.parse(fs.readFileSync(CHUNKS_PATH, 'utf8'));
  let totalLen = 0;
  for (const c of CHUNKS) {
    const tokens = tokenize(c.text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    TF.push({ tf, len: tokens.length });
    totalLen += tokens.length;
    for (const t of tf.keys()) DF.set(t, (DF.get(t) || 0) + 1);
  }
  AVGDL = totalLen / (CHUNKS.length || 1);
  console.log(`[knowledge] ${CHUNKS.length} pasajes cargados.`);
}

// BM25
const K1 = 1.5;
const B = 0.75;

function retrieve(query, k = 6) {
  load();
  if (!CHUNKS.length) return [];
  const qTerms = [...new Set(tokenize(query))];
  if (!qTerms.length) return [];
  const N = CHUNKS.length;
  const scores = new Array(N).fill(0);
  for (const term of qTerms) {
    const df = DF.get(term);
    if (!df) continue;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (let i = 0; i < N; i++) {
      const f = TF[i].tf.get(term);
      if (!f) continue;
      const denom = f + K1 * (1 - B + (B * TF[i].len) / AVGDL);
      scores[i] += idf * ((f * (K1 + 1)) / denom);
    }
  }
  const ranked = scores
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => ({ ...CHUNKS[x.i], score: +x.s.toFixed(2) }));
  return ranked;
}

// Devuelve un bloque de texto listo para inyectar como contexto del sistema.
function buildContext(query, { k = 6, maxChars = 9000 } = {}) {
  const hits = retrieve(query, k);
  if (!hits.length) return '';
  let out = '';
  for (const h of hits) {
    const piece = `\n[Fuente: ${h.title}]\n${h.text}\n`;
    if ((out + piece).length > maxChars) break;
    out += piece;
  }
  if (!out) return '';
  return (
    '==========================================\n' +
    'CONOCIMIENTO TÉCNICO DE REFERENCIA (uso interno)\n' +
    '==========================================\n' +
    'Extractos de la biblioteca técnica de B-GOR sobre nutrición, sanidad y manejo animal. ' +
    'Úsalos para responder con precisión y profundidad las dudas TÉCNICAS del cliente. ' +
    'Resume y explica en simple; NO copies textual ni cites "el documento". ' +
    'Si la pregunta es de un producto B-GOR, prioriza la info de producto del prompt principal. ' +
    'Si aquí no está la respuesta, dilo con honestidad y deriva al WhatsApp.\n' +
    out
  );
}

module.exports = { retrieve, buildContext, load };
