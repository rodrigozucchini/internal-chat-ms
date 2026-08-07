import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from './user.entity';
import { REDIS_CLIENT } from '../redis/redis.provider';

const CACHE_TTL_SECONDS = 300; // 5 minutos

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  private cacheKey(id: string) {
    return `profile:${id}`;
  }

  async getProfile(id: string): Promise<User | null> {
    const cached = await this.redis.get(this.cacheKey(id));
    if (cached) {
      return JSON.parse(cached);
    }

    const profile = await this.userRepo.findOneBy({ id });
    if (profile) {
      await this.redis.set(
        this.cacheKey(id),
        JSON.stringify(profile),
        'EX',
        CACHE_TTL_SECONDS,
      );
    }
    return profile;
  }

  async upsertProfile(
    data: Partial<User> & { id: string },
  ): Promise<User | null> {
    await this.userRepo.upsert(data, ['id']);
    await this.redis.del(this.cacheKey(data.id));
    return this.getProfile(data.id);
  }
}
