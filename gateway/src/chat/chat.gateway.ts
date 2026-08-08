import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { io, Socket as ChatServiceSocket } from 'socket.io-client';
import { verifyAuth0Token } from '../auth/verify-auth0-token';

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL;
if (!CHAT_SERVICE_URL) throw new Error('Falta la variable de entorno CHAT_SERVICE_URL (.env)');

const ACK_TIMEOUT_MS = 5000;

interface SendMessageInput {
  recipientId: string;
  content: string;
}

async function relay(upstream: ChatServiceSocket, event: string, payload: unknown) {
  try {
    return await upstream.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'Chat Service no está disponible' };
  }
}

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  async handleConnection(client: Socket) {
    try {
      client.data.sub = (await verifyAuth0Token(client.handshake.auth?.token)).sub;
    } catch {
      client.emit('error', 'Token inválido o faltante');
      return client.disconnect(true);
    }

    // Una conexión propia hacia chat-service por cada cliente conectado
    // acá — chat-service hace el join y el reparto real con su propia
    // sala; el Gateway solo reenvía en las dos direcciones.
    const upstream: ChatServiceSocket = io(CHAT_SERVICE_URL);
    client.data.upstream = upstream;
    upstream.on('messageReceived', (message) => client.emit('messageReceived', message));
  }

  handleDisconnect(client: Socket) {
    client.data.upstream?.disconnect();
  }

  @SubscribeMessage('joinChannel')
  handleJoinChannel(@MessageBody() channelId: string, @ConnectedSocket() client: Socket) {
    return relay(client.data.upstream, 'joinChannel', channelId);
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(@MessageBody() input: SendMessageInput, @ConnectedSocket() client: Socket) {
    return relay(client.data.upstream, 'sendMessage', {
      senderId: client.data.sub,
      recipientId: input.recipientId,
      content: input.content,
    });
  }

  @SubscribeMessage('getMessages')
  handleGetMessages(@MessageBody() channelId: string, @ConnectedSocket() client: Socket) {
    return relay(client.data.upstream, 'getMessages', channelId);
  }
}
