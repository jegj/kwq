import { Controller, Get, Render } from '@nestjs/common';

@Controller('app')
export class DashboardController {
  @Get('dashboard')
  @Render('app-layout')
  getDashboard() {
    return {
      title: 'Dashboard',
      page: './pages/dashboard',
      // ponytail: no session yet, so no real logged-in user to read the
      // email from — swap this for the session user once login lands.
      email: 'you@example.com',
    };
  }
}
