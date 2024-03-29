import { Module } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModule } from '../../../modules/transaciton.module';
import { DatabaseModule, POSTGRES_CONNECTION } from './database.module';
import { UserModule } from './user.module';
import { QueueModule } from './queue.module';

@Module({
  imports: [
    AopModule,
    DatabaseModule,
    TransactionModule.regist({
      defaultConnectionName: POSTGRES_CONNECTION,
    }),
    UserModule,
    QueueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
