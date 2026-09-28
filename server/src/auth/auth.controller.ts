import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Render,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { GuestGuard } from './guard/guest.guard.js';
import { signAuthToken, verifyAuthToken } from './util/jwt.util.js';

const SESSION_COOKIE = 'session';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('login')
  @UseGuards(GuestGuard)
  @Render('layout')
  getLogin() {
    return { title: 'Log in', page: './pages/login' };
  }

  @Post('login')
  async login(
    @Body() { email, password }: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const user = await this.authService.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.authService.recordLogin(user.id);

    const token = signAuthToken(user);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    reply.status(HttpStatus.FOUND).redirect('/app/dashboard');
  }

  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = request.cookies?.session;
    const payload = token ? verifyAuthToken(token) : null;
    if (payload) {
      await this.authService.recordLogout(payload.id);
    }

    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.status(HttpStatus.FOUND).redirect('/auth/login');
  }
}
