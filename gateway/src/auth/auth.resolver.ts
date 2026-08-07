import { Context, Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AuthResolver {
  @Query(() => String)
  whoAmI(@Context() context): string {
    return context.req.auth.payload.sub;
  }
}
