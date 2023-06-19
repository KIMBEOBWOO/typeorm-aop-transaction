import { applyDecorators, SetMetadata } from '@nestjs/common';
import { EntityTarget } from 'typeorm';
import { CUSTOM_REPOSITORY_METADATA } from '../const/custom-repository-metadata';

export function CustomTransactionRepository(
  target: EntityTarget<any>,
  repositoryToken?: symbol | string,
) {
  if (repositoryToken !== undefined) {
    return applyDecorators(
      SetMetadata(CUSTOM_REPOSITORY_METADATA.REPOSITORY_TARGET, target),
      SetMetadata(CUSTOM_REPOSITORY_METADATA.REPOSITORY_TOKEN, repositoryToken),
    );
  } else {
    return applyDecorators(
      SetMetadata(CUSTOM_REPOSITORY_METADATA.REPOSITORY_TARGET, target),
    );
  }
}
