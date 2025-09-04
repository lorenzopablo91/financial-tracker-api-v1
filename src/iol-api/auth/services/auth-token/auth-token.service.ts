import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { RefreshTokenResponse, TokenResponse } from '../../interfaces/token.interface';
import { AuthTokenHelper } from '../../helpers/auth-token.helper';

@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private currentToken: string | null = null;
  private currentRefreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshTokenExpiresAt: Date | null = null;

  private readonly tokenUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly grantType: string = 'password';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.tokenUrl = this.configService.get<string>('IOL_TOKEN_URL') || '';
    this.username = this.configService.get<string>('IOL_USERNAME') || '';
    this.password = this.configService.get<string>('IOL_PASSWORD') || '';
  }

  private async requestToken(params: URLSearchParams): Promise<TokenResponse | RefreshTokenResponse> {
    try {
      const response: AxiosResponse<TokenResponse | RefreshTokenResponse> = await firstValueFrom(
        this.httpService.post(this.tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error en requestToken:', error.response?.data || error.message);
      throw new HttpException(
        'Error al obtener token de autenticación IOL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getInitialToken(): Promise<TokenResponse> {
    const params = AuthTokenHelper.buildParams({
      username: this.username,
      password: this.password,
      grant_type: this.grantType,
    });

    const tokenData = (await this.requestToken(params)) as TokenResponse;

    AuthTokenHelper.saveTokenData(tokenData, {
      setToken: (v) => (this.currentToken = v),
      setRefreshToken: (v) => (this.currentRefreshToken = v),
      setTokenExpiresAt: (v) => (this.tokenExpiresAt = v),
      setRefreshTokenExpiresAt: (v) => (this.refreshTokenExpiresAt = v),
    });

    this.logger.log('Token inicial obtenido exitosamente');
    return tokenData;
  }

  private async refreshAccessToken(): Promise<RefreshTokenResponse> {
    if (!this.currentRefreshToken) {
      this.logger.warn('No hay refresh token disponible, obteniendo token inicial');
      return this.getInitialToken();
    }

    const params = AuthTokenHelper.buildParams({
      refresh_token: this.currentRefreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const tokenData = (await this.requestToken(params)) as RefreshTokenResponse;

      AuthTokenHelper.saveTokenData(tokenData, {
        setToken: (v) => (this.currentToken = v),
        setRefreshToken: (v) => (this.currentRefreshToken = v),
        setTokenExpiresAt: (v) => (this.tokenExpiresAt = v),
        setRefreshTokenExpiresAt: (v) => (this.refreshTokenExpiresAt = v),
      });

      this.logger.log('Token IOL renovado exitosamente');
      return tokenData;
    } catch {
      this.logger.warn('Refresh token falló, obteniendo nuevo token inicial');
      return this.getInitialToken();
    }
  }

  async getValidToken(): Promise<string> {
    const now = new Date();

    if (!this.currentToken || !this.tokenExpiresAt || now >= this.tokenExpiresAt) {
      this.logger.log('Token IOL expirado o no disponible, renovando...');
      if (this.currentRefreshToken && this.refreshTokenExpiresAt && now < this.refreshTokenExpiresAt) {
        await this.refreshAccessToken();
      } else {
        await this.getInitialToken();
      }
    }

    return this.currentToken!;
  }

  getTokenInfo() {
    const now = new Date();
    return {
      hasToken: !!this.currentToken,
      tokenExpiresAt: this.tokenExpiresAt,
      refreshTokenExpiresAt: this.refreshTokenExpiresAt,
      isTokenExpired: !this.tokenExpiresAt || now >= this.tokenExpiresAt,
      isRefreshTokenExpired: !this.refreshTokenExpiresAt || now >= this.refreshTokenExpiresAt,
    };
  }

  clearTokens(): void {
    this.currentToken = null;
    this.currentRefreshToken = null;
    this.tokenExpiresAt = null;
    this.refreshTokenExpiresAt = null;
    this.logger.log('Tokens IOL limpiados');
  }
}
