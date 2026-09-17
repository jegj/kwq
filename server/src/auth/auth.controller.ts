import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Render,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { GuestGuard } from './guard/guest.guard.js';
import { signAuthToken } from './util/jwt.util.js';

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

    const token = signAuthToken(user);
    reply.setCookie(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    reply.status(HttpStatus.FOUND).redirect('/app/dashboard');
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) reply: FastifyReply) {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    reply.status(HttpStatus.FOUND).redirect('/auth/login');
  }
}
