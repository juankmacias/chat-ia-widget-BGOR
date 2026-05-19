# Chat IA Widget — BGOR

Widget de chat estilo WhatsApp con Claude (Anthropic) como motor de IA, configurado como **asesor informativo para BGOR**. A diferencia del proyecto base (PowerMix, que es de ventas), este chat tiene como objetivo resolver dudas técnicas por **línea de producto** y derivar a un humano cuando se requiera comprar o atención personalizada.

## Líneas de producto BGOR

El chat trabaja sobre 4 líneas principales:

1. **Rumiantes**
2. **Mono gástricos**
3. **Equinos**
4. **Potros**

> El system-prompt (`system-prompt.js`) tiene **placeholders** en cada línea — hay que reemplazarlos con la información real (productos, especies, beneficios, dosificación, registro ICA) tomada de las fichas técnicas oficiales.

## Flujo del chat

- Cuando el usuario pregunta por **beneficios, características, dosificación o aspectos específicos del producto**, el bot pregunta primero **para qué animal** (Rumiantes / Mono gástricos / Equinos / Potros).
- Una vez identificada la línea, responde con info específica.
- Para preguntas generales (qué es BGOR, envíos, comprar) **no pregunta la línea**.
- Cuando el usuario quiere **comprar, hablar con un humano, o pedir algo que el bot no sabe**, lo deriva al WhatsApp **573209216434**.

## Estructura

```
chat-ia-widget-BGOR/
├── server.js              # Servidor Express + endpoint /api/chat
├── db.js                  # Pool de Neon + helpers de BD
├── db-init.js             # Script para crear las tablas
├── system-prompt.js       # Personalidad y conocimiento del bot — EDITAR CON FICHAS TÉCNICAS
├── config.js              # Límite de mensajes por sesión
├── schema.sql             # Esquema SQL
├── package.json
├── .env.example           # Plantilla de variables (copia a .env)
├── public/
│   ├── index.html         # Página demo
│   ├── widget.css         # Estilos estilo WhatsApp
│   ├── widget.js          # Lógica del widget
│   └── media/             # Audios / imágenes / videos (vacío por ahora)
└── views/
    └── admin.html         # Panel admin (seguimiento de conversaciones)
```

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar plantilla de entorno y editar .env
cp .env.example .env
# Edita .env con ANTHROPIC_API_KEY, DATABASE_URL (otra base Neon distinta a PowerMix),
# ALLOWED_ORIGIN (dominio de BGOR) y credenciales del admin.

# 3. Crear tablas en Neon
npm run db:init

# 4. Llenar system-prompt.js con las fichas técnicas reales de cada línea

# 5. Arrancar servidor
npm start
# o en desarrollo con auto-reload
npm run dev
```

Abre http://localhost:3000 para ver la página demo con el widget.

## Crear la base de datos en Neon

1. Entra a [neon.tech](https://neon.tech), crea un **proyecto nuevo** (no reutilizar el de PowerMix).
2. Copia el `DATABASE_URL` y pégalo en `.env`.
3. Ejecuta `npm run db:init` (o pega el contenido de `schema.sql` en el SQL Editor de Neon).

## Llenar el system-prompt con las fichas técnicas

Edita `system-prompt.js` y reemplaza los bloques `[PENDIENTE LLENAR: ...]` de cada línea con:

- Productos disponibles
- Especies cubiertas
- Beneficios específicos
- Dosificación recomendada
- Registro ICA de cada producto
- Modo de uso

Las fichas técnicas oficiales son la fuente de verdad — el bot no debe inventar dosificaciones ni registros.

## Integrar en el sitio real de BGOR

```html
<link rel="stylesheet" href="https://tu-servidor.com/widget.css" />
<script>
  window.CHAT_WIDGET_API_URL = "https://tu-servidor.com/api/chat";
  window.CHAT_WIDGET_BOT_NAME = "Asesor BGOR";
  window.CHAT_WIDGET_WELCOME = "Hola, soy el asesor de IA de BGOR 😊. ¿En qué te puedo ayudar?";
  window.CHAT_WIDGET_WHATSAPP = "573209216434";
</script>
<script src="https://tu-servidor.com/widget.js"></script>
```

## Subir a GitHub

```bash
git init
git add .
git commit -m "Setup inicial del chat IA BGOR"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/chat-ia-widget-BGOR.git
git push -u origin main
```

## Contacto humano configurado

- WhatsApp BGOR (handoff): **573209216434**
- Chat humano de referencia (estructura de atención por especie): 3209381950
