import { Injectable } from '@nestjs/common';
import { DeleteResult, MoreThan, Repository } from 'typeorm';
import { PROPAGATION } from '../../../const/propagation';
import { InjectTransactionRepository } from '../../../decorators/inject-transaction-repository.decorator';
import { Transactional } from '../../../decorators/transactional.decorator';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectTransactionRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Transactional({
    propagation: PROPAGATION.REQUIRED,
  })
  async create(dto: CreateUserDto) {
    const user = new User();
    user.user_id = dto.user_id;
    user.email = dto.email;
    user.password = dto.password;
    user.phone_number = dto.phone_number;

    await this.create2({ ...dto, user_id: dto.user_id + '2' });
    await this.userRepository.insert(user);
  }

  @Transactional({
    propagation: PROPAGATION.REQUIRED,
  })
  async create2(dto: CreateUserDto) {
    const user = new User();
    user.user_id = dto.user_id;
    user.email = dto.email;
    user.password = dto.password;
    user.phone_number = dto.phone_number;

    await this.userRepository.insert(user);
  }

  @Transactional({
    propagation: 'REQUIRED',
  })
  async findAll(): Promise<User[]> {
    const result = await this.userRepository.find({
      order: {
        created_at: 'DESC',
      },
    });

    return result;
  }

  @Transactional({
    propagation: 'REQUIRED',
  })
  async findOne(id: string): Promise<User | null> {
    const result = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    return result;
  }

  @Transactional()
  async delete(id: string): Promise<DeleteResult> {
    const deleteResult = await this.userRepository.delete(id);

    return deleteResult;
  }

  @Transactional()
  async deleteAll() {
    await this.userRepository.delete({
      created_at: MoreThan(new Date(0)),
    });
  }
}
