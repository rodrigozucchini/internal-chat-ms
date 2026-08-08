import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './channel.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { PubSubProvider } from './pubsub.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Channel, Message])],
  providers: [ChatService, ChatResolver, PubSubProvider],
})
export class ChatModule {}
