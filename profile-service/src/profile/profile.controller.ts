import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { ProfileService } from './profile.service';

@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @GrpcMethod('ProfileService', 'GetProfile')
  async getProfile(data: { id: string }) {
    const profile = await this.profileService.getProfile(data.id);
    if (!profile) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Perfil no encontrado',
      });
    }
    return profile;
  }

  @GrpcMethod('ProfileService', 'UpsertProfile')
  upsertProfile(data: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string;
  }) {
    return this.profileService.upsertProfile(data);
  }
}
