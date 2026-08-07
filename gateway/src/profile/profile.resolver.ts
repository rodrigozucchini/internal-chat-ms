import { Inject, OnModuleInit, UseGuards } from '@nestjs/common';
import { Context, Query, Resolver } from '@nestjs/graphql';
import { ClientGrpc } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { firstValueFrom, Observable } from 'rxjs';
import { GqlThrottlerGuard } from '../rate-limit/gql-throttler.guard';
import { Profile } from './profile.type';

const AUTH0_DOMAIN =
  process.env.AUTH0_DOMAIN || 'dev-icyc53hvag0w7sfw.us.auth0.com';

interface UpsertProfileInput {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

interface ProfileServiceGrpc {
  getProfile(data: { id: string }): Observable<Profile>;
  upsertProfile(data: UpsertProfileInput): Observable<Profile>;
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
    const { sub } = context.req.auth.payload;

    try {
      return await firstValueFrom(this.profileService.getProfile({ id: sub }));
    } catch (err: any) {
      if (err?.code !== status.NOT_FOUND) throw err;
    }

    // Primer login: todavía no existe el perfil — lo creamos con los datos
    // reales del usuario, pidiéndoselos a Auth0 (el access token no los trae).
    const userInfoRes = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: context.req.headers.authorization },
    });
    const userInfo = await userInfoRes.json();

    return firstValueFrom(
      this.profileService.upsertProfile({
        id: sub,
        email: userInfo.email ?? '',
        name: userInfo.name ?? '',
        avatarUrl: userInfo.picture ?? '',
      }),
    );
  }
}
