import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { HealthResolver } from './health.resolver';
import { AuthResolver } from './auth/auth.resolver';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      context: ({ req }) => ({ req }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ProfileModule,
  ],
  providers: [HealthResolver, AuthResolver],
})
export class AppModule {}
