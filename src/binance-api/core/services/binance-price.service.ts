import { Injectable, Logger } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { BinanceWebsocketService } from './binance-websocket.service';

export interface CryptoTicker {
    price: number;
    priceChangePercent: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
}

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(
        private readonly websocketService: BinanceWebsocketService
    ) { }

    /**
     * Precios simples (mantiene compatibilidad con ValuationService y otros)
     */
    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        if (symbols.length === 0) {
            return from(Promise.resolve({}));
        }
        return from(this.getCryptoPricesInternal(symbols));
    }

    /**
     * Ticker completo con variación 24h, high, low y volumen
     */
    getCryptoTickers(symbols: string[]): Observable<Record<string, CryptoTicker>> {
        if (symbols.length === 0) {
            return from(Promise.resolve({}));
        }
        return from(this.getCryptoTickersInternal(symbols));
    }

    private async getCryptoPricesInternal(symbols: string[]): Promise<Record<string, number>> {
        try {
            const tickers = await this.websocketService.getTickersOnce(symbols);
            const prices: Record<string, number> = {};
            for (const [symbol, ticker] of Object.entries(tickers)) {
                prices[symbol] = ticker.price;
            }
            this.logger.log(`✅ WebSocket: ${Object.keys(prices).length}/${symbols.length} precios`);
            return prices;
        } catch (error) {
            this.logger.error('❌ Error obteniendo precios:', error?.message);
            return {};
        }
    }

    private async getCryptoTickersInternal(symbols: string[]): Promise<Record<string, CryptoTicker>> {
        try {
            const tickers = await this.websocketService.getTickersOnce(symbols);
            this.logger.log(`✅ WebSocket tickers: ${Object.keys(tickers).length}/${symbols.length}`);
            return tickers;
        } catch (error) {
            this.logger.error('❌ Error obteniendo tickers:', error?.message);
            return {};
        }
    }
}