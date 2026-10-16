import { Controller, Get, Query, Render, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guard/session.guard.js';
import type { AuthenticatedUser } from '../auth/types/auth.types.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { DashboardService } from './dashboard.service.js';

const CURRENT_PATH = '/app/dashboard';

@Controller('app')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @UseGuards(SessionGuard)
  @Render('app-layout')
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
  ) {
    const monthNav = this.dashboardService.getMonthNav(month);
    const summaries = await this.dashboardService.getSummaries(
      user.id,
      monthNav.month,
    );
    return {
      title: 'Dashboard',
      page: './pages/dashboard',
      email: user.email,
      role: user.role,
      currentPath: CURRENT_PATH,
      monthNav,
      summaries,
    };
  }
}
