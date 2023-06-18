export interface TransactionModuleOption {
  /**
   * default TypeORM database connection name
   */
  defaultConnectionName: string;

  /**
   * Specifies whether the transaction is logged for execution.
   * When set to true, grants a unique id for each request and logs
   * the transaction progress to the console.
   */
  logging?: 'all' | 'log' | 'debug' | 'error';
}
