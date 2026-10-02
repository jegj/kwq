import { Role } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserDto {
  @IsEnum(Role)
  role!: Role;
}
