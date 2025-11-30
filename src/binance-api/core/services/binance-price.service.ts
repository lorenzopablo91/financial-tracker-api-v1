import { Injectable, Logger } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { BinanceWebsocketService } from './binance-websocket.service';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(
        private readonly websocketService: BinanceWebsocketService
    ) { }

    /**
     * Obtiene precios de criptomonedas desde Binance usando WebSocket
     */
    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        if (symbols.length === 0) {
            return from(Promise.resolve({}));
        }

        return from(this.getCryptoPricesInternal(symbols));
    }

    private async getCryptoPricesInternal(symbols: string[]): Promise<Record<string, number>> {
        try {
            const prices = await this.websocketService.getPricesOnce(symbols);

            if (Object.keys(prices).length > 0) {
                this.logger.log(`✅ WebSocket: ${Object.keys(prices).length}/${symbols.length} precios`);
                return prices;
            }

            this.logger.warn('⚠️ WebSocket no retornó precios');
            return {};
        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error('❌ Error obteniendo precios de WebSocket:', errorMsg);
            return {};
        }
    }

}