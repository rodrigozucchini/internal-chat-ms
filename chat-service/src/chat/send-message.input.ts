import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class SendMessageInput {
  @Field()
  senderId: string; // temporal — en la Fase 4 lo va a mandar el Gateway, ya validado

  @Field()
  recipientId: string;

  @Field()
  content: string;
}
