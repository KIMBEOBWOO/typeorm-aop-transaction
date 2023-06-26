import { CreateUserDto } from '../dtos/create-user.dto';

export const getCreateUserDto = (identifier: number) => {
  return new CreateUserDto({
    email: 'test email' + identifier,
    user_id: 'test user id' + identifier,
    password: 'test user password' + identifier,
    phone_number: 'test phone number' + identifier,
  });
};
