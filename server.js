const express = require('express');
const path = require('path');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = process.env.PORT || 8080;
const USER = process.env.TIKTOK_USERNAME;

let eventos = [];
let nextId = 1;
function push(e) {
  e.id = nextId++;
  eventos.push(e);
  if (eventos.length > 200) eventos.shift();
}

function nombreDe(user) {
  return (user && (user.nickname || user.uniqueId)) || 'alguien';
}

function conectar() {
  if (!USER) { console.log('Sin TIKTOK_USERNAME: el juego corre solo (modo prueba)'); return; }
  const opciones = {};
  if (process.env.EULERSTREAM_API_KEY) opciones.signApiKey = process.env.EULERSTREAM_API_KEY;
  const conn = new TikTokLiveConnection(USER, opciones);

  conn.on(WebcastEvent.CHAT, d => {
    const texto = d.content || d.comment;
    if (texto) push({ tipo: 'chat', texto, usuario: nombreDe(d.user) });
  });

  conn.on(WebcastEvent.GIFT, d => {
    const g = d.gift || {};
    const racha = g.type === 1; // regalos con combo: solo contamos al terminar la racha
    if (racha && !d.repeatEnd) return;
    const monedas = (g.diamondCount || 1) * (d.repeatCount || 1);
    push({ tipo: 'gift', monedas, regalo: g.name || 'regalo', usuario: nombreDe(d.user) });
  });

  conn.on(ControlEvent.DISCONNECTED, () => { console.log('Desconectado, reintento...'); setTimeout(conectar, 15000); });
  conn.on(ControlEvent.ERROR, ({ info }) => console.error('Error:', info));
  conn.connect()
    .then(s => console.log('Conectado al live, room', s.roomId))
    .catch(err => { console.error('No se pudo conectar:', err.message || err); setTimeout(conectar, 15000); });
}
conectar();

const app = express();
app.use(express.static(__dirname));
app.get('/api/eventos', (req, res) => {
  const ultimo = nextId - 1;
  if (req.query.desde === undefined) return res.json({ ultimo, eventos: [] });
  const desde = Number(req.query.desde) || 0;
  res.json({ ultimo, eventos: eventos.filter(e => e.id > desde) });
});
app.listen(PORT, () => console.log('Plataformas corriendo en el puerto ' + PORT));
