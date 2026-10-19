import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EnvironmentVariables } from './config/env.validation.js';
import { verifyAuthToken } from './auth/util/jwt.util.js';

@Controller()
export class AppController {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get()
  root(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = request.cookies?.session;
    const authed = token
      ? verifyAuthToken(token, this.config.get('JWT_SECRET'))
      : null;
    reply
      .status(HttpStatus.FOUND)
      .redirect(authed ? '/app/dashboard' : '/auth/login');
  }
}
