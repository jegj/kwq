import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateUserDto } from './admin/dto/create-user.dto.js';
import { ChangePasswordDto } from './settings/dto/change-password.dto.js';

const tooLong = 'a'.repeat(129);

describe('password max length', () => {
  it('rejects an overlong password when creating a user', async () => {
    const dto = Object.assign(new CreateUserDto(), {
      email: 'a@b.co',
      role: 'USER',
      password: tooLong,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(['password']);
  });

  it('rejects an overlong new password on change', async () => {
    const dto = Object.assign(new ChangePasswordDto(), {
      currentPassword: 'old',
      newPassword: tooLong,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(['newPassword']);
  });
});
