import { Module } from '@nestjs/common';
import { TransactionModule } from '../../../modules/transaciton.module';
import { UserController } from '../controllers/user.controller';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';

@Module({
  imports: [TransactionModule.setRepository([User])],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
