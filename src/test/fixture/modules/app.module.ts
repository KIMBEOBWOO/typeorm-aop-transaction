import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AopModule } from '@toss/nestjs-aop';
import { TransactionModule } from '../../../modules/transaciton.module';
import { TransactionMiddleware } from '../../../providers/transaction.middleware';
import { DatabaseModule, POSTGRES_CONNECTION } from './database.module';

@Module({
  imports: [
    AopModule,
    DatabaseModule,
    TransactionModule.regist({
      defaultConnectionName: POSTGRES_CONNECTION,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TransactionMiddleware).forRoutes('*');
  }
}
