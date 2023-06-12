import { Logger } from '@nestjs/common';
import { createNamespace, getNamespace, Namespace } from 'cls-hooked';
import { Aspect, LazyDecorator, WrapParams } from '@toss/nestjs-aop';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

import { TransactionOptions } from './transaction-option.interface';
import { Propagation } from './propagation';
import { TRANSACTION_DECORATOR } from './transaction-decorator.symbol';

@Aspect(TRANSACTION_DECORATOR)
export class ClsHookedTransactinoDecorator
  implements LazyDecorator<any, TransactionOptions>
{
  /**
   * 트랜잭션 네임스페이스 이름
   */
  static readonly NAMESPACE_NAME = 'TX';
  /**
   * 트랜잭션 컨텍스트 쿼리러너 키 접두사
   */
  static readonly QUERY_RUNNER_PRERIX = 'queryRunner';

  constructor(private readonly dataSource: DataSource) {
    // cls-hooked context 초기화
    getNamespace(ClsHookedTransactinoDecorator.NAMESPACE_NAME) ||
      createNamespace(ClsHookedTransactinoDecorator.NAMESPACE_NAME);
  }

  /**
   * 트랜잭션 Proxy 메서드
   */
  wrap({ metadata, method, methodName }: WrapParams<any, TransactionOptions>) {
    return async (...args: any) => {
      const txNamespace = ClsHookedTransactinoDecorator.getTxNamespace();

      // 전파 옵션 설정
      const propagation: Propagation =
        metadata?.propagation === undefined ? 'REQUIRED' : metadata.propagation;

      // 트랜잭션 네임스페이스로 위임 대상 메서드 랩핑
      return txNamespace.runAndReturn(async () => {
        if (propagation === 'REQUIRED') {
          // 쿼리러너 설정
          const queryRunner: QueryRunner =
            ClsHookedTransactinoDecorator.getTxQueryRunner(txNamespace) ||
            this.dataSource.createQueryRunner(); // 존재하지 않는 경우 새로 생성해 초기화

          // 트랜잭션 진행 여부 조회
          const isTransactionActive = queryRunner.isTransactionActive;

          if (isTransactionActive) {
            // 이미 진행 중인 트랜잭션이 존재, 참여
            Logger.debug(methodName, 'start ' + propagation + ' origin');

            return this.runInTransaction(method, args);
          } else {
            // 진행 중인 트랜잭션이 없음, 생성
            Logger.debug(methodName, 'start ' + propagation + ' new');

            return this.wrapByTransaction(
              method,
              args,
              txNamespace,
              queryRunner,
            );
          }
        } else if (propagation === 'REQUIRES_NEW') {
          // 진행 중인 모든 트랜잭션을 보류하고 새롭게 시작
          Logger.debug(methodName, 'start ' + propagation + ' new');

          const queryRunner = this.dataSource.createQueryRunner();
          return this.wrapByTransaction(method, args, txNamespace, queryRunner);
        } else {
          throw new Error('사용할 수 없는 전파 옵션 ' + metadata?.propagation);
        }
      });
    };
  }

  /**
   * 트랜잭션내에서 함수 실행
   * @param method 타깃 메서드
   * @param args 타깃 메서드 호출 파라미터
   * @returns 타깃 메서드 호출 결과 (return value of method)
   *
   * @description 해당 메서드는 호출시 별도의 트랜잭션 경계 설정 없이 모든 작업을 타깃 메서드에게 위임한다.
   */
  private async runInTransaction(method: any, args: any[]) {
    const result = await method(...args);

    return result;
  }

  /**
   * 새 트랜잭션내에서 함수 실행
   * @param method 타깃 메서드
   * @param args 타깃 메서드 호출 파라미터
   * @param txNamespace 트랜잭션 네임스페이스
   * @param queryRunner 트랜잭션 실행할 커넥션 쿼리러너
   * @returns 타깃 메서드 호출 결과 (return value of method)
   *
   * @description 해당 메서드는 호출시 타깃 메서드에 트랜잭션 경계 설정 부가기능을 추가하고 핵심 기능은 타깃 메서드에게 위임한다.
   */
  private async wrapByTransaction(
    method: any,
    args: any[],
    txNamespace: Namespace,
    queryRunner: QueryRunner,
  ) {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 진행 중인 트랜잭션이 없으므로 설정
      ClsHookedTransactinoDecorator.setTxQueryRunner(queryRunner, txNamespace);

      console.log(ClsHookedTransactinoDecorator.getTxNamespace());

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

  /**
   * 트랜잭션 cls-hooked 네임스페이스 getter
   * @returns Namespace, 요청 수명주기를 가지는 트랜잭션 네임스페이스
   */
  static getTxNamespace(): Namespace {
    const txNamespace: Namespace | undefined = getNamespace(
      ClsHookedTransactinoDecorator.NAMESPACE_NAME,
    );

    if (txNamespace === undefined) {
      throw new Error(
        ClsHookedTransactinoDecorator.NAMESPACE_NAME + ' 이 초기화되지않음.',
      );
    }

    return txNamespace;
  }

  /**
   * 트랜잭션 컨텍스트에 저장된 쿼리러너 getter
   * @param _txNamespace Namespace
   * @returns QueryRunner | undefined
   */
  static getTxQueryRunner(_txNamespace?: Namespace): QueryRunner | undefined {
    const txNamespace =
      _txNamespace || ClsHookedTransactinoDecorator.getTxNamespace();

    const queryRunner: QueryRunner | undefined = txNamespace.get(
      ClsHookedTransactinoDecorator.QUERY_RUNNER_PRERIX,
    );

    return queryRunner;
  }

  /**
   * 트랜잭션 컨텍스트에 쿼리러너 저장
   * @param queryRunner QueryRunner
   * @param _txNamespace Namespace
   * @returns QueryRunner
   */
  static setTxQueryRunner(
    queryRunner: QueryRunner,
    _txNamespace?: Namespace,
  ): QueryRunner {
    const txNamespace =
      _txNamespace || ClsHookedTransactinoDecorator.getTxNamespace();

    return txNamespace.set(
      ClsHookedTransactinoDecorator.QUERY_RUNNER_PRERIX,
      queryRunner,
    );
  }

  /**
   * 베이스 레파지토리 설정 변경
   * @param repositoryPrototype 레파지토리 클래스 프로토타입
   */
  static setUpBaseRepository(repositoryPrototype: ThisType<Repository<any>>) {
    Object.defineProperty(repositoryPrototype, 'manager', {
      get() {
        const queryRunner = ClsHookedTransactinoDecorator.getTxQueryRunner();

        console.log(ClsHookedTransactinoDecorator.getTxQueryRunner());

        if (queryRunner === undefined) {
          throw new Error('쿼리러너가 존재하지 않음. 쿼리 실행 불가능');
        }

        return queryRunner.manager;
      },
      set(manager: EntityManager) {
        this.manager = manager;
      },
    });
  }
}
