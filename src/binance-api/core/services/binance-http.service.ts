import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { BinanceAuthService } from '../../auth/services/binance-auth/binance-auth.service';
import { BinanceBaseHelper } from '../helpers/binance-base.helper';

@Injectable()
export class BinanceHttpService {
    private readonly logger = new Logger(BinanceHttpService.name);
    private readonly baseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly binanceAuthService: BinanceAuthService,
    ) {
        this.baseUrl = this.configService.get<string>('BINANCE_BASE_URL') || '';
    }

    makePublicRequest<T = any>(endpoint: string, params?: Record<string, any>): Observable<T> {
        const url = BinanceBaseHelper.buildUrl(this.baseUrl, endpoint, params);
        const headers = this.binanceAuthService.createPublicHeaders();

        return this.httpService.get(url, { headers }).pipe(
            BinanceBaseHelper.mapResponse<T>(),
            BinanceBaseHelper.withErrorHandler<T>(),
        );
    }

    makeSignedRequest<T = any>(endpoint: string, params: Record<string, any> = {}): Observable<T> {
        const extendedParams = { ...params, recvWindow: 60000, omitZeroBalances: true };
        const signedRequest = this.binanceAuthService.createSignedRequest(endpoint, extendedParams);
        const fullUrl = `${this.baseUrl}${signedRequest.url}`;

        return this.httpService.get(fullUrl, { headers: signedRequest.headers }).pipe(
            BinanceBaseHelper.mapResponse<T>(),
            BinanceBaseHelper.withErrorHandler<T>(),
        );
    }
}