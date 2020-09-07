import { PrimaryKey } from '@mikro-orm/core';
import { v4 } from 'uuid';

export abstract class OrmIdEntity {

  @PrimaryKey()
  public id: string = v4();

}
