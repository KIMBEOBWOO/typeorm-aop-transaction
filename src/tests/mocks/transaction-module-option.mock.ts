import { TransactionModuleOption } from '../../interfaces/transaction-module-option.interface';

export const getMockTransactionModuleOption = (): TransactionModuleOption => ({
  defaultConnectionName: 'TEST_DEFAULT_CONNECTION_NAME',
});
