import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, from, switchMap, map, catchError, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { IolAuthService } from 'src/iol-api/auth/services/iol-auth/iol-auth.service';
import { IolBaseHelper } from '../../helpers/iol-base.helper';

@Injectable()
export class IolBaseService {
  private readonly logger = new Logger(IolBaseService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly iolAuthService: IolAuthService,
  ) {
    this.baseUrl = this.configService.get<string>('IOL_BASE_URL') || '';

    if (!this.baseUrl) {
      this.logger.error('IOL_BASE_URL no está configurada');
      throw new Error('IOL_BASE_URL configuration is missing');
    }
  }

  makeAuthenticatedRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    customHeaders?: Record<string, string>,
    retryCount: number = 0,
    isInitialRequest: boolean = true
  ): Observable<T> {
    return from(this.iolAuthService.getValidToken()).pipe(
      switchMap((token) => {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...customHeaders,
        };

        const config = {
          headers,
          // Timeout más largo para primera request (cold start)
          timeout: isInitialRequest ? 45000 : 30000, // 45s primera vez, 30s después
        };
        const url = `${this.baseUrl}${endpoint}`;

        if (method === 'POST') {
          return this.httpService.post(url, data, config);
        } else {
          return this.httpService.get(url, config);
        }
      }),
      map((response: AxiosResponse<T>) => {
        return response.data;
      }),
      catchError((error) => {
        this.logger.error(`IOL API Error: ${error.message}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          code: error.code,
          endpoint,
          method,
          retryCount,
          isInitialRequest
        });

        // Reintentar en casos de conectividad/servidor (incluyendo cold starts)
        const shouldRetryConnectivity = retryCount < 2 && (
          error.code === 'ECONNABORTED' || // Timeout
          error.code === 'ECONNREFUSED' || // Servidor no disponible
          error.code === 'ENOTFOUND' ||    // DNS issues
          error.code === 'ECONNRESET' ||   // Conexión reseteada
          error.response?.status === 502 || // Bad Gateway
          error.response?.status === 503 || // Service Unavailable  
          error.response?.status === 504    // Gateway Timeout
        );

        if (shouldRetryConnectivity) {
          const delay = Math.min(2000 * Math.pow(2, retryCount), 8000); // Max 8 segundos
          this.logger.warn(`Reintentando request por conectividad en ${delay}ms... Intento ${retryCount + 1}`);

          return new Observable(subscriber => {
            setTimeout(() => {
              this.makeAuthenticatedRequest(endpoint, method, data, customHeaders, retryCount + 1, false)
                .subscribe(subscriber);
            }, delay);
          });
        }

        // Si es error 401 (Unauthorized), limpiar tokens e intentar una vez más
        if (error.response?.status === 401 && retryCount === 0) {
          this.logger.warn('Token inválido (401), limpiando tokens y reintentando...');
          this.iolAuthService.clearTokens();

          return this.makeAuthenticatedRequest(endpoint, method, data, customHeaders, retryCount + 1, false);
        }

        // Si es error 429 (Too Many Requests), esperar y reintentar
        if (error.response?.status === 429 && retryCount < 2) {
          this.logger.warn(`Rate limit alcanzado (429), reintentando en 3 segundos... Intento ${retryCount + 1}`);

          return new Observable(subscriber => {
            setTimeout(() => {
              this.makeAuthenticatedRequest(endpoint, method, data, customHeaders, retryCount + 1, false)
                .subscribe(subscriber);
            }, 3000); // Esperar 3 segundos para rate limiting
          });
        }

        return throwError(() => IolBaseHelper.handleError(error));
      })
    );
  }

  get<T = any>(endpoint: string, params?: Record<string, any>): Observable<T> {
    let url = endpoint;

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
      url += `?${queryString.toString()}`;
    }

    return this.makeAuthenticatedRequest<T>(url, 'GET');
  }

  post<T = any>(endpoint: string, data?: any): Observable<T> {
    return this.makeAuthenticatedRequest<T>(endpoint, 'POST', data);
  }

}