import { ConsoleLogger } from '@nestjs/common';
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

    it('If you call the constructor with undefined, you must set logging up to the log level', () => {
      const logger = new TransactionLogger({
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(logger).toMatchObject(
        new ConsoleLogger('Transactional', {
          logLevels: ['log'],
        }),
      );
    });

    it('If you call the constructor with specific logging level, you must set logging up to the specific log level', () => {
      const logger = new TransactionLogger({
        logging: 'error',
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(logger).toMatchObject(
        new ConsoleLogger('Transactional', {
          logLevels: ['error'],
        }),
      );
    });

    it('If you call the constructor without level, you must set logging up to the log level', () => {
      const logger = new TransactionLogger({
        defaultConnectionName: 'TEST DEFAULT CONNECTION NAME',
      });

      expect(logger.options.logLevels).toStrictEqual(['log']);
    });
  });
});
