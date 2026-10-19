import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Render,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { GuestGuard } from './guard/guest.guard.js';
import { signAuthToken, verifyAuthToken } from './util/jwt.util.js';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // matches the JWT's 7d expiry
const LOGIN_ATTEMPTS_PER_MINUTE = 5;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('login')
  @UseGuards(GuestGuard)
  @Render('layout')
  getLogin() {
    return { title: 'Log in', page: './pages/login' };
  }

  // Per client IP, in memory (resets on restart; fine for a single instance).
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  async login(
    @Body() { email, password }: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      // Not @Render: Nest renders after the handler returns even when we
      // redirected (success path below), which would double-send.
      reply.status(HttpStatus.UNAUTHORIZED).view('layout', {
        title: 'Log in',
        page: './pages/login',
        error: 'Invalid email or password',
        email,
      });
      return;
    }
    await this.authService.recordLogin(user.id);

    const token = signAuthToken(user, this.config.get('JWT_SECRET'));
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('APP_ENV') !== 'development',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    reply.status(HttpStatus.FOUND).redirect('/app/dashboard');
  }

  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = request.cookies?.session;
    const payload = token
      ? verifyAuthToken(token, this.config.get('JWT_SECRET'))
      : null;
    if (payload) {
      await this.authService.recordLogout(payload.id);
    }

    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.status(HttpStatus.FOUND).redirect('/auth/login');
  }
}
