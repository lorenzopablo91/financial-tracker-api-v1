import { Injectable, Logger } from '@nestjs/common';
import { Observable, forkJoin, of, map, catchError, throwError } from 'rxjs';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { BinancePriceData } from '../interfaces/binance-response.interface';
import { BinanceHttpService } from './binance-http.service';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(private readonly httpService: BinanceHttpService) { }

    private fetchSingleCryptoPrice(symbol: string): Observable<{ symbol: string; price: number } | null> {
        if (symbol === 'USDT') return of({ symbol: 'USDT', price: 1 });

        const usdtSymbol = `${symbol}USDT`;
        return this.httpService.makePublicRequest<BinancePriceData>(
            BINANCE_ENDPOINTS.TICKER_PRICE,
            { symbol: usdtSymbol }
        ).pipe(
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

                if (Object.keys(priceMap).length === 0) {
                    throw new Error('No cryptocurrency prices could be fetched');
                }
                return priceMap;
            }),
        );
    }

    getHistoricalPriceUSD(symbol: string, timestamp: number): Observable<number> {
        if (!symbol || symbol.trim() === '') {
            this.logger.error('Invalid symbol provided:', symbol);
            return throwError(() => new Error(`Invalid symbol: ${symbol}`));
        }

        if (!timestamp || timestamp <= 0) {
            this.logger.error('Invalid timestamp provided:', timestamp);
            return throwError(() => new Error(`Invalid timestamp: ${timestamp}`));
        }

        const interval = '1d';
        const startTime = timestamp;
        const endTime = timestamp + 24 * 60 * 60 * 1000;

        const requestParams = {
            symbol: symbol.trim(),
            interval,
            startTime,
            endTime,
            limit: 1,
        };

        return this.httpService.makePublicRequest<BinancePriceData>(BINANCE_ENDPOINTS.PRICE, requestParams).pipe(
            map((prices) => {
                if (!prices || !Array.isArray(prices) || prices.length === 0) {
                    throw new Error(`No price data available for ${symbol} at ${new Date(timestamp).toISOString()}`);
                }

                const kline = prices[0];
                if (!kline || kline.length < 5) {
                    throw new Error(`Invalid kline data for ${symbol}`);
                }

                const closePrice = parseFloat(kline[4]);
                if (isNaN(closePrice) || closePrice <= 0) {
                    throw new Error(`Invalid price data for ${symbol}: ${kline[4]}`);
                }

                return closePrice;
            }),
            catchError((error) => {
                this.logger.warn(`Failed to fetch price for ${symbol}:`, error.message);
                return of(1);
            })
        );
    }

    getTicker24hr(symbol?: string): Observable<any> {
        const params = symbol ? { symbol: symbol.toUpperCase() } : {};
        return this.httpService.makePublicRequest(BINANCE_ENDPOINTS.TICKER_24HR, params);
    }
}