import { Injectable, Logger } from '@nestjs/common';
import { Observable, of, map, catchError, throwError, timeout, lastValueFrom } from 'rxjs';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { BinancePriceData } from '../interfaces/binance-response.interface';
import { BinanceHttpService } from './binance-http.service';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(private readonly httpService: BinanceHttpService) { }

    async getCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
        try {
            const allPrices = await lastValueFrom(
                this.httpService
                    .makePublicRequest<any[]>(BINANCE_ENDPOINTS.TICKER_PRICE)
                    .pipe(
                        timeout(10000),
                        map(response => response),
                        catchError(error => {
                            this.logger.error('Error fetching all Binance prices:', error.message);
                            return of([]);
                        })
                    )
            );

            // Filtrar solo los símbolos que necesitas
            const result: Record<string, number> = {};

            symbols.forEach(symbol => {
                const symbolWithUSDT = `${symbol}USDT`;
                const priceData = allPrices.find(p => p.symbol === symbolWithUSDT);

                if (priceData && priceData.price) {
                    result[symbol] = parseFloat(priceData.price);
                } else {
                    this.logger.warn(`Price not found for ${symbol}`);
                }
            });

            this.logger.log(`✅ Prices obtained: ${Object.keys(result).length}/${symbols.length}`);
            return result;

        } catch (error) {
            this.logger.error('Critical error in getCryptoPrices:', error);
            throw new Error('No cryptocurrency prices could be fetched');
        }
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