export interface TransactionModuleOptionInput {
  /**
   * default TypeORM database connection name
   */
  defaultConnectionName?: string;

  /**
   * Specifies whether the transaction is logged for execution.
   * When set to true, grants a unique id for each request and logs
   * the transaction progress to the console.
   */
  logging?: 'all' | 'log' | 'debug' | 'error';
}

export interface TransactionModuleOption extends TransactionModuleOptionInput {
  /**
   * The connection name is required for the Transaction Module Option
   */
  defaultConnectionName: string;
}
