// Prueba el chat de punta a punta A TRAVÉS DEL GATEWAY (no directo a chat-service).
// Uso:
//   node test-chat-client.js <JWT>                              → manda un mensaje (crea el canal)
//   node test-chat-client.js <JWT> <channelId> <recipientId>     → se suscribe y espera un mensaje

const { io } = require('socket.io-client');

const TOKEN = process.argv[2];
const CHANNEL_ID = process.argv[3];
const RECIPIENT_ID = process.argv[4] || 'user-b';

if (!TOKEN) {
  console.error('Uso: node test-chat-client.js <JWT> [channelId] [recipientId]');
  process.exit(1);
}

const socket = io('http://localhost:4001', { auth: { token: TOKEN } });

socket.on('connect', () => {
  console.log('Conectado al Gateway, socket id:', socket.id);

  if (!CHANNEL_ID) {
    console.log('Sin channelId — mando un mensaje para crear el canal...');
    socket.emit('sendMessage', { recipientId: RECIPIENT_ID, content: 'hola vía Gateway' }, (ack) => {
      console.log('ACK sendMessage:', JSON.stringify(ack));
      console.log('Fijate que "senderId" sea tu propio sub, no algo que vos mandaste.');
      process.exit(ack.ok ? 0 : 1);
    });
    return;
  }

  socket.emit('joinChannel', CHANNEL_ID, (ack) => console.log('ACK joinChannel:', JSON.stringify(ack)));

  socket.on('messageReceived', (message) => {
    console.log('MENSAJE RECIBIDO (vía Gateway):', JSON.stringify(message));
    process.exit(0);
  });

  console.log(`Suscripto al canal ${CHANNEL_ID}, esperando mensajes...`);
});

socket.on('error', (err) => console.error('ERROR del Gateway:', err));
socket.on('connect_error', (err) => {
  console.error('ERROR de conexión:', err.message);
  process.exit(1);
});
socket.on('disconnect', (reason) => console.log('Desconectado:', reason));

setTimeout(() => {
  console.log('Timeout — no llegó ningún mensaje en 10s');
  process.exit(1);
}, 10000);
