import 'dotenv/config'; // tiene que ir primero: carga .env antes de que app.module.ts lea process.env
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = process.env.PORT;
  if (!port) throw new Error('Falta la variable de entorno PORT (.env)');
  await app.listen(port, '0.0.0.0');
  console.log(`Chat Service (GraphQL) escuchando en 0.0.0.0:${port}`);
}
bootstrap();
