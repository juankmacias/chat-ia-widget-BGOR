const { getAdminStats } = require('../../db');
const { json, checkAdminAuth } = require('./_lib');

exports.handler = async (event) => {
  const authError = checkAdminAuth(event);
  if (authError) return authError;

  try {
    const stats = await getAdminStats();
    return json(200, stats);
  } catch (err) {
    console.error('Error en admin-stats:', err);
    return json(500, { error: 'Error', detail: err.message });
  }
};
