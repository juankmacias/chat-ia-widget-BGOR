require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const {
  listConversations,
  getConversationMessages,
  getAdminStats,
} = require('./db');
const { handleChat } = require('./chat-core');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || false,
}));
app.use(express.json({ limit: '100kb' }));

const MEDIA_DIR = path.join(__dirname, 'public', 'media');
const MEDIA_EXTS = {
  audio: ['.mp3', '.ogg', '.m4a', '.wav'],
  image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  video: ['.mp4', '.webm', '.mov'],
};

app.get('/media/:type/:slug', (req, res, next) => {
  const { type, slug } = req.params;
  const exts = MEDIA_EXTS[type];
  if (!exts || !/^[a-z0-9-]+$/.test(slug)) return next();
  for (const ext of exts) {
    const filePath = path.join(MEDIA_DIR, type, slug + ext);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
  }
  res.status(404).send('Media not found');
});

// Página principal: landing simple + chat protagonista
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing-simple.html'));
});

// Landing experta: se abre cuando el chat detecta perfil técnico/profesional
app.get('/experto', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'bgor.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  const userAgent = req.headers['user-agent']?.slice(0, 300) ?? null;
  const ip = (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null;

  const { status, body } = await handleChat({ sessionId, message, userAgent, ip });
  res.status(status).json(body);
});

function adminAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return res.status(500).send('ADMIN_USER y ADMIN_PASS no configurados en .env');
  }
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  if (req.headers.authorization !== expected) {
    res.set('WWW-Authenticate', 'Basic realm="B-GOR Admin"');
    return res.status(401).send('Auth required');
  }
  next();
}

app.get('/admin', adminAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/api/admin/stats', adminAuth, async (_req, res) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (err) {
    console.error('Error en /api/admin/stats:', err);
    res.status(500).json({ error: 'Error', detail: err.message });
  }
});

app.get('/api/admin/conversations', adminAuth, async (req, res) => {
  try {
    const { limit, offset, from, to, ip, at_limit } = req.query;
    const rows = await listConversations({
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      from: from || undefined,
      to: to || undefined,
      ip: ip || undefined,
      atLimit: at_limit === 'true' ? true : at_limit === 'false' ? false : undefined,
    });
    res.json(rows);
  } catch (err) {
    console.error('Error en /api/admin/conversations:', err);
    res.status(500).json({ error: 'Error', detail: err.message });
  }
});

app.get('/api/admin/conversations/:id/messages', adminAuth, async (req, res) => {
  try {
    const messages = await getConversationMessages(req.params.id);
    res.json(messages);
  } catch (err) {
    console.error('Error en /api/admin/conversations/:id/messages:', err);
    res.status(500).json({ error: 'Error', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
