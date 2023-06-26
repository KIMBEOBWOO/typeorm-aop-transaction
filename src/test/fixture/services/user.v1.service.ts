import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PROPAGATION } from '../../../const/propagation';
import { InjectTransactionRepository } from '../../../decorators/inject-transaction-repository.decorator';
import { Transactional } from '../../../decorators/transactional.decorator';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';

export interface ServiceFixtureOption {
  afterCallback?: (...param: any[]) => Promise<any>;
}

@Injectable()
export class UserV1Service {
  constructor(
    @InjectTransactionRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Transactional()
  async createRequried(
    dto: CreateUserDto,
    fixtureOption?: ServiceFixtureOption,
  ) {
    const user = new User();
    user.user_id = dto.user_id;
    user.email = dto.email;
    user.password = dto.password;
    user.phone_number = dto.phone_number;

    await this.userRepository.insert(user);

    fixtureOption?.afterCallback && (await fixtureOption.afterCallback());
  }

  @Transactional({
    propagation: PROPAGATION.REQUIRES_NEW,
  })
  async createRequriesNew(
    dto: CreateUserDto,
    fixtureOption?: ServiceFixtureOption,
  ) {
    const user = new User();
    user.user_id = dto.user_id;
    user.email = dto.email;
    user.password = dto.password;
    user.phone_number = dto.phone_number;

    // 2
    await this.userRepository.insert(user);

    fixtureOption?.afterCallback && (await fixtureOption.afterCallback());
  }

  @Transactional({
    propagation: PROPAGATION.NESTED,
  })
  async createNested(dto: CreateUserDto, fixtureOption?: ServiceFixtureOption) {
    const user = new User();
    user.user_id = dto.user_id;
    user.email = dto.email;
    user.password = dto.password;
    user.phone_number = dto.phone_number;

    // 2
    await this.userRepository.insert(user);

    fixtureOption?.afterCallback && (await fixtureOption.afterCallback());
  }

  @Transactional({
    propagation: 'REQUIRED',
  })
  async findAll(): Promise<User[]> {
    const result = await this.userRepository.find({
      order: {
        created_at: 'ASC',
      },
    });

    return result;
  }
}
