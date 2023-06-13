import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AlsStore } from './als-store.interface';

@Injectable()
export class TransactionMiddleware implements NestMiddleware {
  constructor(private readonly alsService: AsyncLocalStorage<AlsStore>) {}

  async use(_req: unknown, _res: unknown, next: Function) {
    const store: AlsStore = {};

    this.alsService.run(store, () => next());
  }
}
