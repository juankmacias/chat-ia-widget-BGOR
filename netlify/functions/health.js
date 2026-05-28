const { json } = require('./_lib');

exports.handler = async () => json(200, { ok: true, ts: new Date().toISOString() });
