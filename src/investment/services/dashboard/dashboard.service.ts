import { Injectable, Logger } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { CRYPTO_METADATA } from 'src/binance-api/core/constants/binance-endpoints';
import { BinanceMainService } from 'src/binance-api/core/services/binance-main.service';

export interface CryptoDashboardItem {
    symbol: string;
    name: string;
    color: string;
    price: number;
    priceChangePercent: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
}

@Injectable()
export class DashboardService {

    private readonly logger = new Logger(DashboardService.name);

    constructor(private readonly binanceService: BinanceMainService) { }

    // ===== ONE-SHOT (REST) =====

    getTickerPrice(symbol: string): Observable<Record<string, number>> {
        return this.binanceService.getCryptoPrices([symbol.toUpperCase()]);
    }

    getMultipleTickerPrices(symbols: string[]): Observable<Record<string, number>> {
        return this.binanceService.getCryptoPrices(symbols.map(s => s.toUpperCase()));
    }

    getTickerData(symbol: string): Observable<CryptoDashboardItem[]> {
        const symbolUpper = symbol.toUpperCase();
        return this.binanceService.getCryptoTickers([symbolUpper]).pipe(
            map(tickers => this.mapToDashboardItems([symbolUpper], tickers))
        );
    }

    getMultipleTickerData(symbols: string[]): Observable<CryptoDashboardItem[]> {
        const symbolsUpper = symbols.map(s => s.toUpperCase());
        return this.binanceService.getCryptoTickers(symbolsUpper).pipe(
            map(tickers => this.mapToDashboardItems(symbolsUpper, tickers))
        );
    }

    // ===== STREAM (SSE) =====

    getCryptoDashboardStream(): Observable<CryptoDashboardItem[]> {
        const cryptoSymbols = (Object.keys(CRYPTO_METADATA) as (keyof typeof CRYPTO_METADATA)[])
            .filter(k => k !== 'USDT');

        this.logger.log(`Starting dashboard stream for: ${cryptoSymbols.join(', ')}`);

        return this.binanceService.getCryptoTickers(cryptoSymbols).pipe(
            map(tickers => this.mapToDashboardItems(cryptoSymbols, tickers))
        );
    }

    // ===== HELPERS =====

    private mapToDashboardItems(
        symbols: string[],
        tickers: Record<string, any>
    ): CryptoDashboardItem[] {
        return symbols
            .filter(symbol => tickers[symbol] !== undefined)
            .map(symbol => {
                const meta = CRYPTO_METADATA[symbol as keyof typeof CRYPTO_METADATA];
                const ticker = tickers[symbol];
                return {
                    symbol,
                    name: meta?.name ?? symbol,
                    color: meta?.color ?? '#6B7280',
                    price: ticker.price,
                    priceChangePercent: ticker.priceChangePercent,
                    highPrice: ticker.highPrice,
                    lowPrice: ticker.lowPrice,
                    volume: ticker.volume,
                };
            });
    }
}