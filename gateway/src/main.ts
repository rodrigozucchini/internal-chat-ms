import { NestFactory } from '@nestjs/core';
import { auth } from 'express-oauth2-jwt-bearer';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    auth({
      audience: process.env.AUTH0_AUDIENCE || 'https://internalsystem/',
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN || 'dev-icyc53hvag0w7sfw.us.auth0.com'}/`,
    }),
  );

  const port = process.env.PORT || 4001; // 4000 puede estar ocupado en la máquina local
  await app.listen(port, '0.0.0.0');
  console.log(`Gateway (GraphQL) escuchando en 0.0.0.0:${port}`);
}
bootstrap();
