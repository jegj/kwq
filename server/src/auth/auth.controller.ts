import { Controller, Get, Render } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Get('login')
  @Render('login')
  getLogin() {
    return {};
  }
}
