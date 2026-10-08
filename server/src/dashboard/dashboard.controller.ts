import {
  Controller,
  Get,
  Query,
  Render,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionGuard } from '../auth/guard/session.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('app')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @UseGuards(SessionGuard)
  @Render('app-layout')
  async getDashboard(
    @Req() request: FastifyRequest,
    @Query('month') month?: string,
  ) {
    // SessionGuard guarantees a user; this narrows the type without `!`.
    if (!request.user) throw new UnauthorizedException();
    const monthNav = this.dashboardService.getMonthNav(month);
    const summaries = await this.dashboardService.getSummaries(
      request.user.id,
      monthNav.month,
    );
    return {
      title: 'Dashboard',
      page: './pages/dashboard',
      email: request.user?.email,
      role: request.user?.role,
      currentPath: request.url,
      monthNav,
      summaries,
    };
  }
}
