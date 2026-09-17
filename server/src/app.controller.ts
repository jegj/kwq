import { Controller, Get, HttpStatus, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAuthToken } from './auth/util/jwt.util.js';

@Controller()
export class AppController {
  @Get()
  root(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const token = request.cookies?.session;
    const authed = token ? verifyAuthToken(token) : null;
    reply
      .status(HttpStatus.FOUND)
      .redirect(authed ? '/app/dashboard' : '/auth/login');
  }
}
