import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { Observable, map, catchError } from 'rxjs';

export class BinanceBaseHelper {
  private static readonly logger = new Logger(BinanceBaseHelper.name);

  // Construir URL con query params
  static buildUrl(baseUrl: string, endpoint: string, params?: Record<string, any>): string {
    let url = `${baseUrl}${endpoint}`;

    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
      url += `?${queryString.toString()}`;
    }

    return url;
  }

  // Manejo de errores centralizado
  static handleError(error: any): never {
    this.logger.error('Binance API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401) {
      throw new HttpException('Binance API: Invalid API key', HttpStatus.UNAUTHORIZED);
    }

    if (error.response?.status === 403) {
      throw new HttpException('Binance API: Forbidden - Check permissions', HttpStatus.FORBIDDEN);
    }

    if (error.response?.status === 429) {
      throw new HttpException('Binance API: Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (error.response?.data?.code) {
      const binanceError = error.response.data;
      throw new HttpException(
        `Binance API Error ${binanceError.code}: ${binanceError.msg}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    throw new HttpException(
      'Error communicating with Binance API',
      error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  // Wrapper para respuestas estandarizadas
  static formatResponse<T>(data: T, additionalInfo?: Record<string, any>) {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'binance',
      ...additionalInfo,
    };
  }

  // Transformar la respuesta de axios → data
  static mapResponse<T>() {
    return map((response: AxiosResponse<T>) => response.data);
  }

  // Agregar catchError automático
  static withErrorHandler<T>() {
    return catchError<T, Observable<never>>((error) => {
      this.handleError(error);
    });
  }
}
