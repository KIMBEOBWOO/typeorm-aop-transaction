export class NotRollbackError extends Error {
  constructor(e: unknown) {
    super(
      typeof e === 'string'
        ? e
        : e instanceof Error
        ? e.message
        : 'Unhandled error',
    );

    e instanceof Error && ((this.stack = e.stack), (this.name = e.name));
  }
}
