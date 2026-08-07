import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), RedisModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
