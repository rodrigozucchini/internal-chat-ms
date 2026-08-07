import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'profile',
        protoPath: join(__dirname, 'proto/profile.proto'),
        url: '0.0.0.0:5000',
      },
    },
  );
  await app.listen();
  console.log('profile-service (gRPC) escuchando en 0.0.0.0:5000');
}
bootstrap();
