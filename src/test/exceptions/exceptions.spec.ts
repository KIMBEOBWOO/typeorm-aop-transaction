import { NotRollbackError } from '../../exceptions/not-rollback.error';

describe('Exceptions Unit Test', () => {
  describe('NotRollbackError', () => {
    it('All information in the existing error should be wrapped', () => {
      const originError = new Error('TestError');

      const notRollbackError = new NotRollbackError(originError);

      expect(notRollbackError).toMatchObject(originError);
    });
  });
});
