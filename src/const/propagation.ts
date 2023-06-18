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

  /**
   * 외부 트랜잭션에 무조건 참여
   * @description 외부 트랜잭션이 존재하지 않으면 참여할 트랜잭션이 없다는 오류를 발생.
   */
  MANDATORY: 'MANDATORY',

  /**
   * 외부 트랜잭션이 있다면 참여
   * @description 외부 트랜잭션이 존재한다면 참여해 진행하고, 없다면 트랜잭션 없이 실행한다.
   */
  SUPPORTS: 'SUPPORTS',

  /**
   * 어떠한 트랜잭션에도 참여하지 않음.
   * @description 내부 트랜잭션을 포함해 어떤 트랜잭션에도 참여하지 않는다. 만약 호출 컨택스트내에 트랜잭션이 존재하면 오류를 발생.
   */
  NEVER: 'NEVER',

  /**
   * 부모 트랜잭션이 존재하면 부모 트랜잭션에 중첩시키고, 부모 트랜잭션이 존재하지 않는다면 새로운 트랜잭션을 생성한다.
   * @description 부모 트랜잭션에서 오류가 발생한 경우 중첩된 모든 하위 트랜잭션을 롤백시킨다. 자식 트랜잭션에서 오류가 발생한 경우 상위 트랜잭션에는 영향을 미치지 않는다.
   */
  NESTED: 'NESTED',
} as const;

/**
 * 트랜잭션 전파 속성
 */
export type Propagation = (typeof PROPAGATION)[keyof typeof PROPAGATION];
