import { Controller, Get, Render } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('login')
  @Render('layout')
  getLogin() {
    return { title: 'Log in', page: './pages/login' };
  }
}
