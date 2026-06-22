module.exports = {
  // Límite de mensajes por SESIÓN (navegador) en ventana de 24h.
  MAX_USER_MESSAGES: 15,
  // Límite por IP en 24h. Más alto que el de sesión a propósito: muchos
  // usuarios legítimos comparten IP (NAT corporativo, datos móviles, wifi
  // público), así que un tope bajo por IP genera falsos positivos. La sesión
  // es el control principal; la IP solo frena abuso masivo desde un mismo origen.
  MAX_USER_MESSAGES_PER_IP: 50,
};
