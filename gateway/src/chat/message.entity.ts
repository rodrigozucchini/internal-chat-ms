import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  channelId: string;

  @Column()
  senderId: string; // sub de Auth0 de quién lo mandó

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
