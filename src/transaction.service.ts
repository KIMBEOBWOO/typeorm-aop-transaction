import { QueryRunner } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { DataSourceMapService } from './data-source-map.service';

export class TypeORMTransactionService {
  constructor(private readonly dataSourceMapService: DataSourceMapService) {}

  /**
   * 데이터베이스 연결풀에서 연결 획득/생성
   * @param connectionName 데이터베이스 커넥션 이름
   * @returns QueryRunner
   */
  createConnection(connectionName?: string): QueryRunner {
    const dataSource = this.dataSourceMapService.getDataSource(connectionName);

    return dataSource.createQueryRunner();
  }

  /**
   * 트랜잭션내에서 함수 실행
   * @param method 타깃 메서드
   * @param args 타깃 메서드 호출 파라미터
   * @returns 타깃 메서드 호출 결과 (return value of method)
   *
   * @description 해당 메서드는 호출시 별도의 트랜잭션 경계 설정 없이 모든 작업을 타깃 메서드에게 위임한다.
   */
  async runInTransaction(method: (...param: any[]) => any, args: any[]) {
    const result = await method(...args);

    return result;
  }

  /**
   * 새 트랜잭션내에서 함수 실행t
   * @param method 타깃 메서드
   * @param args 타깃 메서드 호출 파라미터
   * @param txNamespace 트랜잭션 네임스페이스
   * @param queryRunner 트랜잭션 실행할 커넥션 쿼리러너
   * @returns 타깃 메서드 호출 결과 (return value of method)
   *
   * @description 해당 메서드는 호출시 타깃 메서드에 트랜잭션 경계 설정 부가기능을 추가하고 핵심 기능은 타깃 메서드에게 위임한다.
   */
  async wrapByTransaction(
    method: (...param: any[]) => any,
    args: any[],
    queryRunner: QueryRunner,
    isolationLevel: IsolationLevel,
  ) {
    await queryRunner.connect();
    await queryRunner.startTransaction(isolationLevel);

    try {
      const result = await method(...args);

      await queryRunner.commitTransaction();

      return result;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}
