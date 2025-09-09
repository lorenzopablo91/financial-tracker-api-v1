import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable, switchMap, map, catchError, forkJoin, of } from 'rxjs';
import { BINANCE_ENDPOINTS, CRYPTO_METADATA } from '../../constants/binance-endpoints';
import { BinanceAuthService } from 'src/binance-api/auth/services/binance-auth/binance-auth.service';
import {
    BinanceAccountBalance,
    BinanceApiResponse,
    BinancePriceData,
    CryptoData,
    BinanceServerTimeResponse,
} from '../../interfaces/binance-response.interface';
import { ConfigService } from '@nestjs/config';
import { BinanceBaseHelper } from '../../helpers/binance-base.helper';

@Injectable()
export class BinanceBaseService {
    protected readonly logger = new Logger(BinanceBaseService.name);
    private readonly baseUrl: string;
    private readonly MIN_USD_VALUE = 1;
    private serverTimeOffset = 0;

    constructor(
        protected readonly configService: ConfigService,
        protected readonly httpService: HttpService,
        protected readonly binanceAuthService: BinanceAuthService,
    ) {
        this.baseUrl = this.configService.get<string>('BINANCE_BASE_URL') || '';
        this.syncServerTime();
    }

    private syncServerTime(): void {
        this.getServerTime().subscribe({
            next: (serverTime) => {
                this.serverTimeOffset = serverTime - Date.now();
            },
            error: (error) => this.logger.warn('Failed to sync server time:', error),
        });
    }

    private getServerTime(): Observable<number> {
        return this.makePublicRequest<BinanceServerTimeResponse>('/api/v3/time').pipe(
            map((response) => response.serverTime),
        );
    }

    protected makePublicRequest<T = any>(endpoint: string, params?: Record<string, any>): Observable<T> {
        const url = BinanceBaseHelper.buildUrl(this.baseUrl, endpoint, params);
        const headers = this.binanceAuthService.createPublicHeaders();

        return this.httpService.get(url, { headers }).pipe(
            BinanceBaseHelper.mapResponse<T>(),
            BinanceBaseHelper.withErrorHandler<T>(),
        );
    }

    protected makeSignedRequest<T = any>(endpoint: string, params: Record<string, any> = {}): Observable<T> {
        const extendedParams = { ...params, recvWindow: 60000, omitZeroBalances: true };
        const signedRequest = this.binanceAuthService.createSignedRequest(endpoint, extendedParams);
        const fullUrl = `${this.baseUrl}${signedRequest.url}`;

        return this.httpService.get(fullUrl, { headers: signedRequest.headers }).pipe(
            BinanceBaseHelper.mapResponse<T>(),
            BinanceBaseHelper.withErrorHandler<T>(),
        );
    }

    // A partir de acá ya es pura lógica de negocio 👇
    formatResponse<T>(data: T, additionalInfo?: Record<string, any>): BinanceApiResponse<T> {
        return BinanceBaseHelper.formatResponse(data, additionalInfo);
    }

    getAccountBalances(): Observable<Record<string, number>> {
        return this.makeSignedRequest<{ balances: BinanceAccountBalance[] }>(BINANCE_ENDPOINTS.ACCOUNT_INFO).pipe(
            map((response) => {
                const balances: Record<string, number> = {};
                response.balances.forEach((balance) => {
                    const total = parseFloat(balance.free) + parseFloat(balance.locked);
                    if (total > 0) balances[balance.asset] = total;
                });

                return balances;
            }),
        );
    }

    private fetchSingleCryptoPrice(symbol: string): Observable<{ symbol: string; price: number } | null> {
        if (symbol === 'USDT') return of({ symbol: 'USDT', price: 1 });

        const usdtSymbol = `${symbol}USDT`;
        return this.makePublicRequest<BinancePriceData>(BINANCE_ENDPOINTS.TICKER_PRICE, { symbol: usdtSymbol }).pipe(
            map((response) => ({ symbol, price: parseFloat(response.price) })),
            catchError((error) => {
                this.logger.warn(`Failed to fetch price for ${symbol}:`, error.message);
                return of(null);
            }),
        );
    }

    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        const validSymbols = symbols.filter((s) => s?.trim());
        if (validSymbols.length === 0) return of({});

        const priceObservables = validSymbols.map((s) => this.fetchSingleCryptoPrice(s.toUpperCase()));
        return forkJoin(priceObservables).pipe(
            map((results) => {
                const priceMap: Record<string, number> = {};
                results.forEach((r) => r && (priceMap[r.symbol] = r.price));

                if (Object.keys(priceMap).length === 0) throw new Error('No cryptocurrency prices could be fetched');
                return priceMap;
            }),
        );
    }

    getCryptoData(): Observable<CryptoData[]> {
        return this.getAccountBalances().pipe(
            switchMap((balances) => {
                const symbols = Object.keys(balances);
                if (symbols.length === 0) return of([]);

                return this.getCryptoPrices(symbols).pipe(
                    map((prices) => {
                        const cryptoData = symbols
                            .filter((s) => CRYPTO_METADATA[s as keyof typeof CRYPTO_METADATA])
                            .map((s) => {
                                const amount = balances[s];
                                const priceUSD = prices[s] || 0;
                                const valueUSD = amount * priceUSD;
                                const metadata = CRYPTO_METADATA[s as keyof typeof CRYPTO_METADATA];
                                return { name: metadata.name, symbol: s, amount, priceUSD, valueUSD, color: metadata.color } as CryptoData;
                            })
                            .filter((c) => c.valueUSD >= this.MIN_USD_VALUE)
                            .sort((a, b) => b.valueUSD - a.valueUSD);

                        return cryptoData;
                    }),
                );
            }),
        );
    }

    getExchangeInfo(): Observable<any> {
        return this.makePublicRequest(BINANCE_ENDPOINTS.EXCHANGE_INFO);
    }

    getTicker24hr(symbol?: string): Observable<any> {
        const params = symbol ? { symbol: symbol.toUpperCase() } : {};
        return this.makePublicRequest(BINANCE_ENDPOINTS.TICKER_24HR, params);
    }
}
