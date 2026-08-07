import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Profile {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatarUrl: string;

  @Field()
  createdAt: string;
}
