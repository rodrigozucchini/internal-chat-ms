import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { verifyAuth0Token } from '../auth/verify-auth0-token';

interface SendMessageInput {
  recipientId: string;
  content: string;
}

const roomFor = (channelId: string) => `channel:${channelId}`;

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(browserSocket: Socket) {
    try {
      const { sub: userId } = await verifyAuth0Token(browserSocket.handshake.auth?.token);
      browserSocket.data.userId = userId;
    } catch {
      browserSocket.emit('error', 'Token inválido o faltante');
      browserSocket.disconnect(true);
    }
  }

  @SubscribeMessage('joinChannel')
  handleJoinChannel(@MessageBody() channelId: string, @ConnectedSocket() browserSocket: Socket) {
    browserSocket.join(roomFor(channelId));
    return { ok: true, data: null };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() input: SendMessageInput,
    @ConnectedSocket() browserSocket: Socket,
  ) {
    try {
      const message = await this.chatService.sendMessage(
        browserSocket.data.userId,
        input.recipientId,
        input.content,
      );

      this.server.to(roomFor(message.channelId)).emit('messageReceived', message);

      return { ok: true, data: message };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'No se pudo enviar el mensaje' };
    }
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(@MessageBody() channelId: string) {
    try {
      const messages = await this.chatService.getMessages(channelId);
      return { ok: true, data: messages };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'No se pudo traer el historial' };
    }
  }
}
