import { Controller, Get, Post, Redirect, Render } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('login')
  @Render('layout')
  getLogin() {
    return { title: 'Log in', page: './pages/login' };
  }

  // ponytail: no session cookie exists yet to clear — this just sends the
  // browser back to login. Wire up cookie clearing once sessions land.
  @Post('logout')
  @Redirect('/auth/login')
  logout() {}
}
