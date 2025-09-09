import { Injectable, Logger, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { RefreshTokenResponse, TokenResponse } from '../../interfaces/token.interface';
import { IolAuthHelper } from '../../helpers/iol-auth.helper';

@Injectable()
export class IolAuthService implements OnModuleInit {
  private readonly logger = new Logger(IolAuthService.name);
  private currentToken: string | null = null;
  private currentRefreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshTokenExpiresAt: Date | null = null;

  // Mutex para evitar múltiples requests de token simultáneos
  private tokenRequestInProgress: Promise<string> | null = null;

  // Estado de inicialización
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private readonly tokenUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly grantType: string = 'password';

  // Configuraciones para cold starts
  private readonly requestTimeout: number = 30000;
  private readonly maxRetries: number = 3;
  private readonly bufferTimeMs: number = 60000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.tokenUrl = this.configService.get<string>('IOL_TOKEN_URL') || '';
    this.username = this.configService.get<string>('IOL_USERNAME') || '';
    this.password = this.configService.get<string>('IOL_PASSWORD') || '';

    // Validar configuración requerida
    if (!this.tokenUrl || !this.username || !this.password) {
      this.logger.error('Configuración IOL incompleta. Verificar IOL_TOKEN_URL, IOL_USERNAME e IOL_PASSWORD');
      throw new Error('IOL configuration is missing required fields');
    }

  }

  /**
   * Inicialización proactiva del servicio
   */
  async onModuleInit() {
    if (this.configService.get<boolean>('IOL_PRELOAD_TOKEN', true)) {
      this.initializationPromise = this.initializeTokens().catch(error => {
        this.logger.warn('Error en precarga de token, se obtendrá bajo demanda:', error.message);
      });
    }
  }

  /**
   * Inicialización de tokens (sin bloquear el arranque)
   */
  private async initializeTokens(): Promise<void> {
    try {
      await this.getInitialToken();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Error en inicialización de tokens:', error.message);
      throw error;
    }
  }

  private async requestToken(params: URLSearchParams): Promise<TokenResponse | RefreshTokenResponse> {
    const startTime = Date.now();

    try {
      const response: AxiosResponse<TokenResponse | RefreshTokenResponse> = await firstValueFrom(
        this.httpService.post(this.tokenUrl, params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: this.requestTimeout,
        }).pipe(
          timeout(this.requestTimeout),
          retry({
            count: this.maxRetries,
            delay: (error, retryIndex) => {
              const baseDelay = Math.min(1000 * Math.pow(2, retryIndex), 10000); // Exponential backoff max 10s
              this.logger.warn(`Retry ${retryIndex + 1}/${this.maxRetries} en ${baseDelay}ms. Error: ${error.message}`);
              return new Promise(resolve => setTimeout(resolve, baseDelay));
            },
            resetOnSuccess: true
          }),
          catchError((error) => {
            const duration = Date.now() - startTime;
            this.logger.error(`Request de token falló después de ${duration}ms:`, {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              message: error.message,
              url: this.tokenUrl,
              timeout: this.requestTimeout
            });
            throw error;
          })
        )
      );

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Manejo específico de errores para cold starts
      if (error.name === 'TimeoutError' || error.code === 'ECONNABORTED') {
        throw new HttpException(
          `Timeout al conectar con IOL API después de ${duration}ms (cold start posible)`,
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      if (error.response?.status === 400) {
        throw new HttpException(
          `Credenciales IOL inválidas o parámetros incorrectos: ${JSON.stringify(error.response.data)}`,
          HttpStatus.BAD_REQUEST,
        );
      } else if (error.response?.status === 401) {
        throw new HttpException(
          'Credenciales IOL no autorizadas',
          HttpStatus.UNAUTHORIZED,
        );
      } else if (error.response?.status === 502 || error.response?.status === 503) {
        throw new HttpException(
          `Servidor IOL temporalmente no disponible (intentado ${duration}ms)`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new HttpException(
        `Error al obtener token de autenticación IOL después de ${duration}ms: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getInitialToken(): Promise<TokenResponse> {
    const params = IolAuthHelper.buildParams({
      username: this.username,
      password: this.password,
      grant_type: this.grantType,
    });

    const tokenData = (await this.requestToken(params)) as TokenResponse;

    IolAuthHelper.saveTokenData(tokenData, {
      setToken: (v) => (this.currentToken = v),
      setRefreshToken: (v) => (this.currentRefreshToken = v),
      setTokenExpiresAt: (v) => (this.tokenExpiresAt = v),
      setRefreshTokenExpiresAt: (v) => (this.refreshTokenExpiresAt = v),
    });

    return tokenData;
  }

  private async refreshAccessToken(): Promise<RefreshTokenResponse> {
    if (!this.currentRefreshToken) {
      this.logger.warn('No hay refresh token disponible, obteniendo token inicial');
      return this.getInitialToken();
    }

    const params = IolAuthHelper.buildParams({
      refresh_token: this.currentRefreshToken,
      grant_type: 'refresh_token',
    });

    try {
      const tokenData = (await this.requestToken(params)) as RefreshTokenResponse;

      IolAuthHelper.saveTokenData(tokenData, {
        setToken: (v) => (this.currentToken = v),
        setRefreshToken: (v) => (this.currentRefreshToken = v),
        setTokenExpiresAt: (v) => (this.tokenExpiresAt = v),
        setRefreshTokenExpiresAt: (v) => (this.refreshTokenExpiresAt = v),
      });

      return tokenData;
    } catch (error) {
      this.logger.warn(`Refresh token falló: ${error.message}. Obteniendo nuevo token inicial`);
      // Limpiar tokens inválidos
      this.currentRefreshToken = null;
      this.refreshTokenExpiresAt = null;
      return this.getInitialToken();
    }
  }

  async getValidToken(): Promise<string> {
    // Esperar inicialización si está en progreso
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch (error) {
        // Ignorar errores de inicialización, se manejará bajo demanda
      }
      this.initializationPromise = null;
    }

    // Si ya hay una solicitud en progreso, esperarla
    if (this.tokenRequestInProgress) {
      return this.tokenRequestInProgress;
    }

    // Usar helper para verificar si necesita refresh
    const tokenNeedsRefresh = !this.currentToken ||
      IolAuthHelper.needsRefresh(this.tokenExpiresAt, this.bufferTimeMs / 60000);

    if (tokenNeedsRefresh) {
      this.tokenRequestInProgress = this.performTokenRefresh();

      try {
        const token = await this.tokenRequestInProgress;
        return token;
      } finally {
        this.tokenRequestInProgress = null;
      }
    }

    return this.currentToken!;
  }

  private async performTokenRefresh(): Promise<string> {
    // Usar helper para verificar refresh token
    const refreshTokenValid = this.currentRefreshToken &&
      !IolAuthHelper.needsRefresh(this.refreshTokenExpiresAt, 1);

    if (refreshTokenValid) {
      await this.refreshAccessToken();
    } else {
      await this.getInitialToken();
    }

    if (!this.currentToken) {
      throw new HttpException(
        'No se pudo obtener un token válido de IOL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.currentToken;
  }

  clearTokens(): void {
    this.currentToken = null;
    this.currentRefreshToken = null;
    this.tokenExpiresAt = null;
    this.refreshTokenExpiresAt = null;
    this.tokenRequestInProgress = null;
    this.isInitialized = false;
  }

}