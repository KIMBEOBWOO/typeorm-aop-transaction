import { AsyncLocalStorage } from 'async_hooks';
import { AlsStore } from '../../interfaces/als-store.interface';
import { TransactionMiddleware } from '../../providers/transaction.middleware';

describe('TransactionMiddleware', () => {
  let middleware: TransactionMiddleware;
  let alsService: AsyncLocalStorage<AlsStore>;

  beforeEach(async () => {
    alsService = new AsyncLocalStorage();
    middleware = new TransactionMiddleware(alsService);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(12345);
    });

    it('initialize the als store and run the next function', () => {
      middleware.use(null, null, () => {
        const store = alsService.getStore();
        expect(store).toStrictEqual({
          _id: '12345',
          parentPropagtionContext: {},
        });
      });
    });
  });
});
