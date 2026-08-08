import 'dotenv/config'; // tiene que ir primero: carga .env antes de que app.module.ts lea process.env
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Placeholder de bootstrap — se reemplaza por un servidor GraphQL + WebSocket
// en los próximos pasos de la Fase 3.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.init();
  console.log('chat-service inicializado (todavía sin GraphQL/WebSocket)');
}
bootstrap();
