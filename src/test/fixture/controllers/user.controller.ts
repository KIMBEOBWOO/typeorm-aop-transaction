import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';
import { UserV1Service } from '../services/user.v1.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserV1Service, // private readonly alsService: AsyncLocalStorage<any>,
  ) {}

  @Post()
  async createUser(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateUserDto,
  ) {
    return await this.userService.createNested(dto);
  }

  @Get('list')
  @UseInterceptors(ClassSerializerInterceptor)
  findAll(): Promise<User[]> {
    return this.userService.findAll();
  }
}
