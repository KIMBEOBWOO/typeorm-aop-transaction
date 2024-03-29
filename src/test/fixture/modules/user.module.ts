import { Module } from '@nestjs/common';
import { TransactionModule } from '../../../modules/transaciton.module';
import { User } from '../entities/user.entity';
import { TestJobConsumer } from '../services/test.processor';
import { UserV1Service } from '../services/user.v1.service';

@Module({
  imports: [TransactionModule.setRepository([User])],
  providers: [UserV1Service, TestJobConsumer],
  exports: [UserV1Service],
})
export class UserModule {}
