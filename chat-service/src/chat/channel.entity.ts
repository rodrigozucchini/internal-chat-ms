import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantAId: string; // sub de Auth0 del usuario 1

  @Column()
  participantBId: string; // sub de Auth0 del usuario 2

  @CreateDateColumn()
  createdAt: Date;
}
