import { NotRollbackError } from '../../exceptions/not-rollback.error';

describe('Exceptions Unit Test', () => {
  describe('NotRollbackError', () => {
    it('All information in the existing error should be wrapped', () => {
      const originError = new Error('TestError');

      const notRollbackError = new NotRollbackError(originError);

      expect(notRollbackError).toMatchObject(originError);
    });

    it('If the type e is a string, the string should be set to an error message.', () => {
      const errorString = 'TestError';

      const notRollbackError = new NotRollbackError(errorString);

      expect(notRollbackError.message).toBe('TestError');
    });

    it('If the type of e is neither a string nor an error instance, set it as a default message error', () => {
      const unknownError = null;

      const notRollbackError = new NotRollbackError(unknownError);

      expect(notRollbackError.message).toBe('Unhandled error');
    });
  });
});
