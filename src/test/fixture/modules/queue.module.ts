import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';

/**
 * BullQueueModule
 * - Global module that provides the bull redis queue.
 * - An example queue is currently inserted and can be added to the "import" item via "registerQueue" if necessary.
 */
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: '127.0.0.1',
        port: 6379,
        password: 'testtest',
      },
    }),
    BullModule.registerQueue({
      name: 'TEST_QUEUE',
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
