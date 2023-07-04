import { TransactionLogger } from '../../providers/transaction.logger';

describe('TransactionLogger', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('If you call the constructor with the all option, you must set logging up to the debug level', () => {
      const setLogLevels = jest.spyOn(
        TransactionLogger.prototype,
        'setLogLevels',
      );

      new TransactionLogger({
        logging: 'all',
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(setLogLevels).toBeCalledWith(['debug']);
    });

    it('If you call the constructor with undefined, you must set logging up to the log level', () => {
      const setLogLevels = jest.spyOn(
        TransactionLogger.prototype,
        'setLogLevels',
      );

      new TransactionLogger({
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
        logging: undefined,
      });

      expect(setLogLevels).toBeCalledWith(['log']);
    });

    it('If you call the constructor with specific logging level, you must set logging up to the specific log level', () => {
      const setLogLevels = jest.spyOn(
        TransactionLogger.prototype,
        'setLogLevels',
      );

      new TransactionLogger({
        logging: 'error',
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(setLogLevels).toBeCalledWith(['error']);
    });
  });
});
