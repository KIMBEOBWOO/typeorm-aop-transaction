import { AsyncLocalStorage } from 'async_hooks';
import { AlsStore } from '../../interfaces/als-store.interface';

export const getMockAlsService = (
  mockData?: Partial<AlsStore>,
): AsyncLocalStorage<AlsStore> =>
  ({
    run: jest.fn(),
    getStore: jest.fn(),
  } as any);
