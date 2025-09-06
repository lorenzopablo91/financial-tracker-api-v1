import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Observable, from, switchMap, map, catchError } from 'rxjs';
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
  }

  makeAuthenticatedRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any,
    customHeaders?: Record<string, string>
  ): Observable<T> {
    return from(this.iolAuthService.getValidToken()).pipe(
      switchMap((token) => {
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...customHeaders,
        };

        const config = { headers };
        const url = `${this.baseUrl}${endpoint}`;

        this.logger.debug(`IOL API ${method}: ${url}`);

        if (method === 'POST') {
          return this.httpService.post(url, data, config);
        } else {
          return this.httpService.get(url, config);
        }
      }),
      map((response: AxiosResponse<T>) => response.data),
      catchError((error) => {
        throw IolBaseHelper.handleError(error);
      })
    );
  }

  formatResponse<T>(data: T, additionalInfo?: Record<string, any>) {
    return IolBaseHelper.formatResponse(data, additionalInfo);
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
