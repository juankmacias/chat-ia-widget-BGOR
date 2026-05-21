// Extrae texto de los PDFs, lo limpia, lo trocea en pasajes y construye el índice
// de conocimiento que usa el chat para recuperar contexto relevante.
//
// Uso: node scripts/build-knowledge.js ["C:\\ruta\\a\\carpeta-pdfs"]
//
// Salida en knowledge/:
//   - <slug>.txt        texto plano por documento (también se sirve si se quiere)
//   - chunks.json       [{ id, slug, title, text }] pasajes para recuperación
//   - docs.json         [{ slug, title, pages, chars, scanned, pdf }] metadatos
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const SRC = process.argv[2] || 'C:\\Users\\cc102\\Downloads\\bgor expert';
const OUT = path.join(__dirname, '..', 'knowledge');
const CHUNK_SIZE = 1200; // caracteres por pasaje (aprox. 300 tokens)
const CHUNK_OVERLAP = 150;

// Títulos legibles por archivo (curados a partir del contenido real).
const TITLES = {
  'BGOR EXPERT .pdf': 'Alimentación y suplementación mineral en bovinos',
  'BGOR EXPERT.pdf': 'Nutrición animal — fundamentos (UAM)',
  'BGOR EXPERT 2.pdf': 'Nutrición animal — manual completo',
  'BGOR EXPERT 3.pdf': 'BPA: alimentación, genética y manejo del hato doble propósito',
  'BGOR EXPERT 4.pdf': 'Difusión tecnológica en el subsector pecuario bovino',
  'BGOR EXPERT 5.pdf': 'Alimentación eficiente de cerdos (monogástricos)',
  'BGOR EXPERT 6.pdf': 'Manual técnico de producción ganadera',
  'BGOR EXPERT 7.pdf': 'Nutrición y requerimientos nutricionales',
  'BGOR EXPERT 8.pdf': 'Manual de manejo y producción pecuaria',
  'bgor expert 9.pdf': 'Guía de manejo ganadero (ilustrada)',
  'BGOR EXPERT 10.pdf': 'Cartilla técnica ganadera',
  'BGOR EXPERT 11.pdf': 'Manual de Buenas Prácticas Ganaderas',
};

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'doc';
}

function clean(text) {
  return text
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, '') // marcadores de página de pdf-parse
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > CHUNK_SIZE && buf) {
      chunks.push(buf.trim());
      buf = buf.slice(Math.max(0, buf.length - CHUNK_OVERLAP)) + '\n\n' + p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  // Subdivide pasajes gigantes (párrafos sin saltos)
  const out = [];
  for (const c of chunks) {
    if (c.length <= CHUNK_SIZE * 1.6) { out.push(c); continue; }
    for (let i = 0; i < c.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      out.push(c.slice(i, i + CHUNK_SIZE));
    }
  }
  return out;
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const usedSlugs = new Set();
  const docs = [];
  const allChunks = [];
  let chunkId = 0;

  for (const file of files) {
    let slug = slugify(file);
    while (usedSlugs.has(slug)) slug += '-b';
    usedSlugs.add(slug);
    try {
      const parser = new PDFParse({ data: fs.readFileSync(path.join(SRC, file)) });
      const data = await parser.getText();
      const pages = (data.pages && data.pages.length) || data.total || null;
      await parser.destroy();
      const text = clean(data.text || '');
      const title = TITLES[file] || slug;
      const scanned = text.length < 500;
      fs.writeFileSync(path.join(OUT, slug + '.txt'), text, 'utf8');
      docs.push({ slug, title, pages, chars: text.length, scanned, pdf: file });

      if (!scanned) {
        for (const c of chunkText(text)) {
          allChunks.push({ id: chunkId++, slug, title, text: c });
        }
      }
      console.log(`✓ ${file} -> ${slug} | ${pages || '?'} págs | ${text.length} chars${scanned ? ' ⚠️ escaneo' : ''}`);
    } catch (err) {
      console.log(`✗ ${file} -> ERROR: ${err.message}`);
      docs.push({ slug, title: TITLES[file] || slug, error: err.message, pdf: file });
    }
  }

  fs.writeFileSync(path.join(OUT, 'docs.json'), JSON.stringify(docs, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'chunks.json'), JSON.stringify(allChunks), 'utf8');
  const totalChars = docs.reduce((s, d) => s + (d.chars || 0), 0);
  console.log(`\nDocumentos: ${docs.length} | Pasajes: ${allChunks.length} | Texto total: ${totalChars} chars (~${Math.round(totalChars / 4)} tokens)`);
})();
