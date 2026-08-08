import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { ChatService } from './chat.service';
import { Message } from './message.entity';
import { SendMessageInput } from './send-message.input';
import { PUB_SUB } from './pubsub.provider';

const MESSAGE_RECEIVED = 'messageReceived';

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chatService: ChatService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @Mutation(() => Message)
  async sendMessage(
    @Args('input') input: SendMessageInput,
  ): Promise<Message> {
    const message = await this.chatService.sendMessage(
      input.senderId,
      input.recipientId,
      input.content,
    );

    await this.pubSub.publish(MESSAGE_RECEIVED, { messageReceived: message });

    return message;
  }

  @Query(() => [Message])
  messages(@Args('channelId') channelId: string): Promise<Message[]> {
    return this.chatService.getMessages(channelId);
  }

  @Subscription(() => Message, {
    filter: (payload, variables) =>
      payload.messageReceived.channelId === variables.channelId,
  })
  messageReceived(@Args('channelId') channelId: string) {
    return this.pubSub.asyncIterableIterator(MESSAGE_RECEIVED);
  }
}
