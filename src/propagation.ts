/**
 * 트랜잭션 전파 속성
 */
export const PROPAGATION = {
  /**
   * 내부 트랜잭션은 실행중인 외부 트랜잭션에 참여 (기본 속성)
   * @description 이미 실행 컨택스트안에서 수행중인 트랜잭션이 있는 경우 해당 트랜잭션에 참여하고 새로운 물리 트랜잭션을 만들지 않는다.
   */
  REQUIRED: 'REQUIRED',

  /**
   * 외부 트랜잭션과 내부 트랜잭션을 분리
   * @description 해당 전파 속성이 적용된 트랜잭션은 새로운 물리 트랜잭션을 생성한다. 따라서 별도의 커밋/롤백 플로우에 의해 제어된다.
   */
  REQUIRES_NEW: 'REQUIRES_NEW',
} as const;

/**
 * 트랜잭션 전파 속성
 */
export type Propagation = (typeof PROPAGATION)[keyof typeof PROPAGATION];
