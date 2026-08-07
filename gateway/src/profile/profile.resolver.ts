import { Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { GqlThrottlerGuard } from '../rate-limit/gql-throttler.guard';
import { Profile } from './profile.type';

interface ProfileServiceGrpc {
  getProfile(data: { id: string }): Observable<Profile>;
}

@Resolver()
export class ProfileResolver implements OnModuleInit {
  private profileService: ProfileServiceGrpc;

  constructor(@Inject('PROFILE_PACKAGE') private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.profileService =
      this.client.getService<ProfileServiceGrpc>('ProfileService');
  }

  @UseGuards(GqlThrottlerGuard)
  @Query(() => Profile)
  async miPerfil(@Context() context): Promise<Profile> {
    const id = context.req.auth.payload.sub;
    return firstValueFrom(this.profileService.getProfile({ id }));
  }
}
