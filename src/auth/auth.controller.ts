import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('login')
  async login(@Body() loginDto: { email: string; password: string }) {
    const result = await this.authService.login(loginDto.email, loginDto.password);

    if (result.error) {
      throw new UnauthorizedException(result.error.message);
    }

    return {
      success: true,
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
      expires_in: result.data.session.expires_in,
      expires_at: result.data.session.expires_at,
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
        role: result.data.user.role,
        name: result.data.user.fullName,
      }
    };
  }

  @Post('refresh')
  async refreshToken(@Body() body: { refresh_token: string }) {
    const result = await this.authService.refreshToken(body.refresh_token);

    if (result.error) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    return {
      success: true,
      access_token: result.data.session.access_token,
      refresh_token: result.data.session.refresh_token,
      expires_in: result.data.session.expires_in,
      expires_at: result.data.session.expires_at,
      user: {
        id: result.data.user.id,
        email: result.data.user.email,
        role: result.data.user.role,
        name: result.data.user.fullName
      }
    };
  }

  @Post('logout')
  async logout(@Body() body: { access_token: string }) {
    await this.authService.logout(body.access_token);
    return {
      success: true,
      message: 'Sesión cerrada exitosamente'
    };
  }
}