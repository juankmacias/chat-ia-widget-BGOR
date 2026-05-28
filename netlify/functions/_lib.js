// Utilidades compartidas por las Netlify Functions.
const fs = require('fs');
const path = require('path');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function text(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders },
    body,
  };
}

function html(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders },
    body,
  };
}

// Basic Auth para endpoints admin. Devuelve null si está OK; si no, devuelve
// la respuesta 401 lista para retornar desde la función.
function checkAdminAuth(event) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    return text(500, 'ADMIN_USER y ADMIN_PASS no configurados en Netlify');
  }
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  const got = event.headers?.authorization || event.headers?.Authorization;
  if (got !== expected) {
    return text(401, 'Auth required', {
      'WWW-Authenticate': 'Basic realm="PowerMix Admin"',
    });
  }
  return null;
}

// Resuelve un archivo declarado en included_files probando rutas candidatas,
// porque la ubicación exacta en el bundle puede variar.
function resolveIncluded(relPath) {
  const candidates = [
    path.join(process.cwd(), relPath),
    path.join(__dirname, relPath),
    path.join(__dirname, '..', relPath),
    path.join(__dirname, '..', '..', relPath),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Extrae la IP real del visitante a partir de los headers de Netlify.
function getClientIp(event) {
  const headers = event.headers || {};
  const xff =
    headers['x-nf-client-connection-ip'] ||
    headers['x-forwarded-for'] ||
    headers['client-ip'] ||
    '';
  const ip = xff.split(',')[0].trim();
  return ip ? ip.slice(0, 64) : null;
}

module.exports = {
  json,
  text,
  html,
  checkAdminAuth,
  resolveIncluded,
  getClientIp,
};
