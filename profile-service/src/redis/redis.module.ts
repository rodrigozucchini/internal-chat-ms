import { Module } from '@nestjs/common';
import { RedisProvider, REDIS_CLIENT } from './redis.provider';

@Module({
  providers: [RedisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
