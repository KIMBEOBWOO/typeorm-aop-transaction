import { Module } from '@nestjs/common';
import { TransactionModule } from '../../../modules/transaciton.module';
import { UserController } from '../controllers/user.controller';
import { User } from '../entities/user.entity';
import { UserService } from '../services/user.service';
import { UserV1Service } from '../services/user.v1.service';

@Module({
  imports: [TransactionModule.setRepository([User])],
  controllers: [UserController],
  providers: [UserService, UserV1Service],
  exports: [UserService, UserV1Service],
})
export class UserModule {}
