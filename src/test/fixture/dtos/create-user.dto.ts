import { IsString, Length } from 'class-validator';
import { User } from '../entities/user.entity';
import { PickType } from '@nestjs/mapped-types';

export class CreateUserDto extends PickType(User, [
  'email',
  'user_id',
  'phone_number',
] as const) {
  @IsString()
  @Length(3, 255)
  readonly password!: string;
}
