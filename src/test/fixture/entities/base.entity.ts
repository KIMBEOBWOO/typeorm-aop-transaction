import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
    default: null,
    nullable: true,
  })
  updated_at!: Date | null;

  @DeleteDateColumn({
    type: 'timestamp with time zone',
    default: null,
    nullable: true,
  })
  deleted_at!: Date | null;
}
