import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProfileService } from './profile.service';

@Controller()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @GrpcMethod('ProfileService', 'GetProfile')
  getProfile(data: { id: string }) {
    return this.profileService.getProfile(data.id);
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
