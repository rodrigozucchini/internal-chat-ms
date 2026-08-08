import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { ProfileResolver } from './profile.resolver';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PROFILE_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'profile',
          protoPath: join(__dirname, '../proto/profile.proto'),
          url: process.env.PROFILE_SERVICE_URL,
        },
      },
    ]),
  ],
  providers: [ProfileResolver],
})
export class ProfileModule {}
