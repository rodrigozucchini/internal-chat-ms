const { createClient } = require('graphql-ws');
const WebSocket = require('ws');

const CHANNEL_ID = process.argv[2];

const client = createClient({
  url: 'ws://localhost:4002/graphql',
  webSocketImpl: WebSocket,
});

console.log(`Suscribiéndome a mensajes del canal ${CHANNEL_ID}...`);

const unsubscribe = client.subscribe(
  {
    query: `subscription($channelId: String!) {
      messageReceived(channelId: $channelId) {
        id
        senderId
        content
      }
    }`,
    variables: { channelId: CHANNEL_ID },
  },
  {
    next: (data) => {
      console.log('MENSAJE RECIBIDO:', JSON.stringify(data.data.messageReceived));
      process.exit(0);
    },
    error: (err) => {
      console.error('ERROR:', err);
      process.exit(1);
    },
    complete: () => console.log('completado'),
  },
);

setTimeout(() => {
  console.log('Timeout — no llegó ningún mensaje en 10s');
  process.exit(1);
}, 10000);
