import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';

// El channelId no se guarda ni se busca en la base: se calcula solo,
// siempre igual para el mismo par de usuarios, sin importar el orden.
function channelIdFor(userA: string, userB: string): string {
  return [userA, userB].sort().join(':');
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<Message> {
    const channelId = channelIdFor(senderId, recipientId);

    return this.messageRepo.save(
      this.messageRepo.create({ channelId, senderId, content }),
    );
  }

  getMessages(channelId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { channelId },
      order: { createdAt: 'ASC' },
    });
  }
}
