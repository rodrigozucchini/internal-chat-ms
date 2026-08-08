import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ObjectType, ID } from '@nestjs/graphql';
import { Channel } from './channel.entity';

@ObjectType()
@Entity('messages')
export class Message {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  channelId: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channelId' })
  channel: Channel; // sin @Field() — no se expone en GraphQL

  @Field()
  @Column()
  senderId: string; // sub de Auth0 de quién lo mandó

  @Field()
  @Column('text')
  content: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;
}
