import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn()
  id: string; // Auth0 "sub", ej: "google-oauth2|123456"

  @Column()
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
