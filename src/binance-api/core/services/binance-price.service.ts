import { Injectable, Logger } from '@nestjs/common';
import { timeout, catchError } from 'rxjs/operators';
import { of, Observable, from, firstValueFrom } from 'rxjs';
import { BinanceCircuitBreakerService } from './binance-circuit-breaker.service';
import { BinanceHttpService } from './binance-http.service';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(
        private readonly binanceHttpService: BinanceHttpService,
        private readonly circuitBreaker: BinanceCircuitBreakerService
    ) { }

    /**
     * Obtiene precios de criptomonedas desde Binance
     * Usa circuit breaker para proteger contra rate limits
     */
    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        if (symbols.length === 0) {
            return of({});
        }

        return from(this.getCryptoPricesInternal(symbols));
    }

    private async getCryptoPricesInternal(symbols: string[]): Promise<Record<string, number>> {
        // Verificar si podemos hacer la request
        if (!this.circuitBreaker.canMakeRequest()) {
            const state = this.circuitBreaker.getState();

            if (state.banInfo) {
                const remainingMs = state.banInfo.until - Date.now();
                const remainingMin = Math.ceil(remainingMs / 60000);
                this.logger.warn(
                    `🚫 Binance bloqueado por ban. Se desbloqueará en ~${remainingMin} minutos`
                );
            } else {
                this.logger.warn(`🚫 Circuit breaker abierto (${state.state})`);
            }

            return {}; // Retornar vacío cuando está bloqueado
        }

        // Intentar obtener precios de Binance
        try {
            const prices = await this.fetchFromBinance(symbols);

            if (Object.keys(prices).length > 0) {
                this.circuitBreaker.recordSuccess();
                this.logger.log(`✅ Binance: ${Object.keys(prices).length}/${symbols.length} precios`);
                return prices;
            }

            this.logger.warn('⚠️ Binance no retornó precios');
            return {};
        } catch (error) {
            // Registrar el error en el circuit breaker
            this.circuitBreaker.recordFailure(error);

            const errorMsg = error?.message || 'Unknown error';
            this.logger.error('❌ Error obteniendo precios de Binance:', errorMsg);

            return {};
        }
    }

    /**
     * Obtiene precios desde la API de Binance
     */
    private async fetchFromBinance(symbols: string[]): Promise<Record<string, number>> {
        try {
            const response = await firstValueFrom(
                this.binanceHttpService.makePublicRequest<any[]>(
                    BINANCE_ENDPOINTS.TICKER_PRICE
                ).pipe(
                    timeout(10000),
                    catchError(error => {
                        throw error;
                    })
                )
            );

            const result: Record<string, number> = {};

            if (Array.isArray(response)) {
                symbols.forEach(symbol => {
                    const symbolWithUSDT = `${symbol.toUpperCase()}USDT`;
                    const priceData = response.find((p: any) => p.symbol === symbolWithUSDT);

                    if (priceData && priceData.price) {
                        result[symbol] = parseFloat(priceData.price);
                    } else {
                        this.logger.debug(`Precio no encontrado para ${symbol}`);
                    }
                });
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtiene el estado del circuit breaker
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }

    /**
     * Resetea el circuit breaker (solo admin/debugging)
     */
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}