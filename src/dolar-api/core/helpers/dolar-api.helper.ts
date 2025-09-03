import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

export class DolarApiHelper {
  private static readonly logger = new Logger('DolarApiHelper');

  static handleError(error: any): Observable<never> {
    this.logger.error('Dólar API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 429) {
      return throwError(() =>
        new HttpException('Dólar API: Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS),
      );
    }

    if (error.response?.status === 404) {
      return throwError(() =>
        new HttpException('Dólar API: Endpoint not found', HttpStatus.NOT_FOUND),
      );
    }

    return throwError(() =>
      new HttpException(
        'Error communicating with Dólar API',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  }

  static formatResponse<T>(data: T, additionalInfo?: Record<string, any>) {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'dolarapi',
      ...additionalInfo,
    };
  }
}
