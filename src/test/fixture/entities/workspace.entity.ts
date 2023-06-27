import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('workspace')
export class Workspace extends BaseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  name!: string;

  @ManyToOne(() => User, (user) => user.workspaceList, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'owner_id' })
  user!: User;
}
