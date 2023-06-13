import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { Propagation } from './propagation';

export interface TransactionOptions {
  /**
   * 데이터베이스 커넥션 이름
   */
  connectionName?: string;

  /**
   * 트랜잭션 고립 수준 설정 옵션
   * @default 'READ COMMITTED' 커밋된 내역만 읽음
   */
  isolationLevel?: IsolationLevel;

  /**
   * 트랜잭션 전파 수준 설정 옵션
   * @default 'REQUIRED' 복수개의 논리 트랜잭션을 단일 물리 트랜잭션으로 수행
   */
  propagation?: Propagation;
}
