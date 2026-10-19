import { Injectable, Logger } from '@nestjs/common';
import { AuthRepository } from './auth.repository.js';
import type { AuthenticatedUser } from './types/auth.types.js';
import { verifyPassword } from './util/password.util.js';

// Well-formed scrypt hash (16-byte salt, 64-byte key) that matches no password.
// Verified against when the email is unknown, so that path costs the same as a
// wrong password and response time doesn't reveal which emails have accounts.
const DUMMY_PASSWORD_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly authRepository: AuthRepository) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      this.logger.warn({ msg: 'Login failed: unknown email', email });
      return null;
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      this.logger.warn({ msg: 'Login failed: wrong password', email });
      await this.authRepository.recordActivity(user.id, 'LOGIN_FAILED');
      return null;
    }
    return { id: user.id, role: user.role, email: user.email };
  }

  async findSessionUser(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.authRepository.findById(id);
    if (!user) return null;
    return { id: user.id, role: user.role, email: user.email };
  }

  async recordLogin(userId: string): Promise<void> {
    await this.authRepository.recordActivity(userId, 'LOGIN');
  }

  async recordLogout(userId: string): Promise<void> {
    await this.authRepository.recordActivity(userId, 'LOGOUT');
  }
}
