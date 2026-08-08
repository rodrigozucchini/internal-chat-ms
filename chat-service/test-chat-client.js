const { io } = require('socket.io-client');

const CHANNEL_ID = process.argv[2];
const SENDER_ID = process.argv[3] || 'user-a';
const RECIPIENT_ID = process.argv[4] || 'user-b';

const socket = io('http://localhost:4002');

socket.on('connect', () => {
  console.log('Conectado, socket id:', socket.id);

  if (!CHANNEL_ID) {
    console.log('Sin channelId — mando un mensaje para crear el canal...');
    socket.emit(
      'sendMessage',
      { senderId: SENDER_ID, recipientId: RECIPIENT_ID, content: 'hola desde test-chat-client' },
      (ack) => {
        console.log('ACK sendMessage:', JSON.stringify(ack));
        process.exit(ack.ok ? 0 : 1);
      },
    );
    return;
  }

  socket.emit('joinChannel', CHANNEL_ID, (ack) => {
    console.log('ACK joinChannel:', JSON.stringify(ack));
  });

  socket.on('messageReceived', (message) => {
    console.log('MENSAJE RECIBIDO (room broadcast):', JSON.stringify(message));
    process.exit(0);
  });

  console.log(`Suscripto al canal ${CHANNEL_ID}, esperando mensajes...`);
});

socket.on('connect_error', (err) => {
  console.error('ERROR de conexión:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout — no llegó ningún mensaje en 10s');
  process.exit(1);
}, 10000);
