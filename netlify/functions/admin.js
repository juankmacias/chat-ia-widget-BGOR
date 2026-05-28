const fs = require('fs');
const { html, checkAdminAuth, resolveIncluded, text } = require('./_lib');

exports.handler = async (event) => {
  const authError = checkAdminAuth(event);
  if (authError) return authError;

  const filePath = resolveIncluded('views/admin.html');
  if (!filePath) return text(500, 'admin.html no incluido en el bundle');

  const body = fs.readFileSync(filePath, 'utf8');
  return html(200, body);
};
