import { Entity } from 'typeorm';
import { BaseRepository } from '../../base.repository';
import { isBaseRepositoryPrototype } from '../../utils/is-base-repository-prototype';
import { isTypeORMEntity } from '../../utils/is-typeorm-entity';

describe('Utility Unit Test', () => {
  describe('isBaseRepositoryPrototype', () => {
    class TestRepository extends BaseRepository<any> {}
    class A {}

    it('If the class inheriting the Base Repository comes as an input, it must return true.', () => {
      const testDataList = [
        { target: TestRepository, result: true },
        { target: 1, result: false },
        { target: '1', result: false },
        { target: null, result: false },
        { target: true, result: false },
        { target: A, result: false },
        { target: { a: 1, b: 2 }, result: false },
      ];

      for (const testData of testDataList) {
        /**
         * @NOTE TypeError: Reflect.getPrototypeOf called on non-object 를 처리하기 위한 조건문 추가
         */
        expect(isBaseRepositoryPrototype(testData.target)).toBe(
          testData.result,
        );
      }
    });
  });

  describe('isTypeORMEntity', () => {
    @Entity('test_table')
    class TestEntity {}

    class NotEntity {}

    it('If the class has @Entity decorator comes as an input, it must return true.', () => {
      const testDataList = [
        { target: TestEntity, result: true },
        { target: NotEntity, result: false },
        { target: { a: 1, b: 2 }, result: false },
        { target: 1, result: false },
        { target: '1', result: false },
        { target: null, result: false },
        { target: true, result: false },
      ];

      for (const testData of testDataList) {
        expect(isTypeORMEntity(testData.target)).toBe(testData.result);
      }
    });
  });
});
