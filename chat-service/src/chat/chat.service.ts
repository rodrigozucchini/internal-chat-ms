import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from './channel.entity';
import { Message } from './message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepo: Repository<Channel>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  private async findOrCreateChannel(
    userA: string,
    userB: string,
  ): Promise<Channel> {
    let channel = await this.channelRepo.findOne({
      where: [
        { participantAId: userA, participantBId: userB },
        { participantAId: userB, participantBId: userA },
      ],
    });

    if (!channel) {
      channel = await this.channelRepo.save(
        this.channelRepo.create({
          participantAId: userA,
          participantBId: userB,
        }),
      );
    }

    return channel;
  }

  async sendMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ): Promise<Message> {
    const channel = await this.findOrCreateChannel(senderId, recipientId);

    return this.messageRepo.save(
      this.messageRepo.create({ channelId: channel.id, senderId, content }),
    );
  }

  getMessages(channelId: string): Promise<Message[]> {
    return this.messageRepo.find({
      where: { channelId },
      order: { createdAt: 'ASC' },
    });
  }
}
