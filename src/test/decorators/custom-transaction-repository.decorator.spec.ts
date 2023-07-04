import { CUSTOM_REPOSITORY_METADATA } from '../../const/custom-repository-metadata';
import { CustomTransactionRepository } from '../../decorators/custom-transaction-repository.decorator';
import { User } from '../fixture/entities/user.entity';

describe('CustomTransactionRepository', () => {
  it('If a repository token is provided, metadata for the REPOSITORY_TARGET, REPOSITORY_TOKEN entries must be set.', () => {
    @CustomTransactionRepository(User, 'test token')
    class TestRepository {}

    expect(
      Reflect.getOwnMetadata(
        CUSTOM_REPOSITORY_METADATA.REPOSITORY_TARGET,
        TestRepository,
      ),
    ).toBe(User);
    expect(
      Reflect.getMetadata(
        CUSTOM_REPOSITORY_METADATA.REPOSITORY_TOKEN,
        TestRepository,
      ),
    ).toBe('test token');
  });

  it('If the repository token is not provided, metadata for the REPOSITORY_TARGET entry must be set.', () => {
    @CustomTransactionRepository(User)
    class TestRepository {}

    expect(
      Reflect.getOwnMetadata(
        CUSTOM_REPOSITORY_METADATA.REPOSITORY_TARGET,
        TestRepository,
      ),
    ).toBe(User);
    expect(
      Reflect.getMetadata(
        CUSTOM_REPOSITORY_METADATA.REPOSITORY_TOKEN,
        TestRepository,
      ),
    ).toBe(undefined);
  });
});
