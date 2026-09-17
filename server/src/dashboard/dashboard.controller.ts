import { Controller, Get, Render, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';

@Controller('app')
export class DashboardController {
  @Get('dashboard')
  @UseGuards(SessionGuard)
  @Render('app-layout')
  getDashboard(@Req() request: FastifyRequest) {
    return {
      title: 'Dashboard',
      page: './pages/dashboard',
      email: request.user?.email,
    };
  }
}
