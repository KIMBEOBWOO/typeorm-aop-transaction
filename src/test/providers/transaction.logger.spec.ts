import { TransactionLogger } from '../../providers/transaction.logger';

describe('TransactionLogger', () => {
  describe('constructor', () => {
    it('If you call the constructor with the all option, you must set logging up to the debug level', () => {
      const logger = new TransactionLogger({
        logging: 'all',
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(logger.options.logLevels).toStrictEqual(['debug']);
    });

    it('If you call the constructor without level, you must set logging up to the log level', () => {
      const logger = new TransactionLogger({
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(logger.options.logLevels).toStrictEqual(['log']);
    });
  });
});
