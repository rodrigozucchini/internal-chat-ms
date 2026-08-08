import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Message } from './message.entity';

interface SendMessagePayload {
  senderId: string;
  recipientId: string;
  content: string;
}

type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

const roomFor = (channelId: string) => `channel:${channelId}`;

@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('joinChannel')
  handleJoinChannel(
    @MessageBody() channelId: string,
    @ConnectedSocket() client: Socket,
  ): Ack<null> {
    client.join(roomFor(channelId));
    return { ok: true, data: null };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() payload: SendMessagePayload): Promise<Ack<Message>> {
    try {
      const message = await this.chatService.sendMessage(
        payload.senderId,
        payload.recipientId,
        payload.content,
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
