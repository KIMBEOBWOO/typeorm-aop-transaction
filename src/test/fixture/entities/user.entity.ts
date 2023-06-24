import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Workspace } from './workspace.entity';

@Entity('user')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: string;

  @Column({
    type: 'varchar',
    length: 30,
  })
  user_id!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  password!: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  email!: string;

  @Column({
    type: 'varchar',
    length: 20,
  })
  phone_number!: string;

  @OneToMany(() => Workspace, (workspace) => workspace.user)
  workspaceList!: Workspace[];
}
