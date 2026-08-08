import 'dotenv/config'; // tiene que ir primero: carga .env antes de que se lea process.env más abajo
import { NestFactory } from '@nestjs/core';
import { auth } from 'express-oauth2-jwt-bearer';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
    }),
  );

  const port = process.env.PORT;
  if (!port) throw new Error('Falta la variable de entorno PORT (.env)');
  await app.listen(port, '0.0.0.0');
  console.log(`Gateway (GraphQL) escuchando en 0.0.0.0:${port}`);
}
bootstrap();
