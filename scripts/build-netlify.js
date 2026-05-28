// Genera public/_redirects con rewrites de /media/:type/:slug → archivo real con extensión.
// El server.js local resuelve la extensión en runtime; en Netlify (estático) lo dejamos
// pre-calculado escaneando public/media/{audio,image,video}/ en tiempo de build.
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MEDIA_DIR = path.join(PUBLIC_DIR, 'media');
const REDIRECTS_PATH = path.join(PUBLIC_DIR, '_redirects');
const TYPES = ['audio', 'image', 'video'];

const lines = [];

for (const type of TYPES) {
  const dir = path.join(MEDIA_DIR, type);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    if (!ext || !/^[a-z0-9-]+$/i.test(base)) continue;
    // /media/audio/slug → /media/audio/slug.mp3 (rewrite con código 200)
    lines.push(`/media/${type}/${base}  /media/${type}/${file}  200`);
  }
}

const header = `# Generado por scripts/build-netlify.js — no editar a mano.\n# Resuelve URLs sin extensión a su archivo real.\n`;
const out = header + lines.join('\n') + '\n';
fs.writeFileSync(REDIRECTS_PATH, out, 'utf8');
console.log(`[build-netlify] ${lines.length} reglas de media escritas en public/_redirects`);
