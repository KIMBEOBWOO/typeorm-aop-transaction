import { createDecorator } from '@toss/nestjs-aop';
import { TRANSACTION_DECORATOR } from './transaction-decorator.symbol';
import { TransactionOptions } from './transaction-option.interface';

/**
 * 트랜잭션 데코레이터 (메서드용)
 * @param options 트랜잭션 전파 및 고립 수준 관련 옵션 설정
 * @returns MethodDecorator
 */
export const Transactional = (options?: TransactionOptions) =>
  createDecorator(TRANSACTION_DECORATOR, options);
