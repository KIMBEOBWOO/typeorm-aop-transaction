import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AlsStore } from '../interfaces/als-store.interface';
import { ALS_SERVICE } from '../symbols/als-service.symbol';

@Injectable()
export class TransactionMiddleware implements NestMiddleware {
  constructor(
    @Inject(ALS_SERVICE)
    private readonly alsService: AsyncLocalStorage<AlsStore>,
  ) {}

  async use(_req: unknown, _res: unknown, next: typeof Function) {
    const store: AlsStore = {
      _id: Date.now().toString(),
      parentPropagtionContext: {},
    };

    this.alsService.run(store, () => next());
  }
}
