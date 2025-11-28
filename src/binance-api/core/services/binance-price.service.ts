import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { timeout, catchError, map, switchMap } from 'rxjs/operators';
import { of, Observable, from } from 'rxjs';
import { BinanceCircuitBreakerService } from './binance-circuit-breaker.service';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly circuitBreaker: BinanceCircuitBreakerService
    ) { }

    /**
     * Obtiene precios de criptomonedas con fallback a CoinGecko
     * Retorna Observable para mantener compatibilidad
     */
    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        if (symbols.length === 0) {
            return of({});
        }

        // Convertir la lógica async a Observable
        return from(this.getCryptoPricesInternal(symbols));
    }

    /**
     * Lógica interna que maneja el circuit breaker y fallback
     */
    private async getCryptoPricesInternal(symbols: string[]): Promise<Record<string, number>> {
        // 1. Intentar Binance primero (si el circuito lo permite)
        if (this.circuitBreaker.canMakeRequest()) {
            try {
                const prices = await this.fetchFromBinance(symbols);

                // Si obtenemos datos exitosamente
                if (Object.keys(prices).length > 0) {
                    this.circuitBreaker.recordSuccess();
                    this.logger.log(`✅ Binance: ${Object.keys(prices).length}/${symbols.length} precios`);
                    return prices;
                }

                this.logger.warn('⚠️ Binance no retornó precios, usando fallback');
            } catch (error) {
                this.circuitBreaker.recordFailure(error);
                this.logger.error('❌ Error en Binance, usando fallback:', error?.message);
            }
        } else {
            const state = this.circuitBreaker.getState();
            this.logger.warn(
                `🚫 Binance bloqueado (${state.state}) - usando CoinGecko directamente`
            );
        }

        // 2. Fallback a CoinGecko
        return await this.fetchFromCoinGecko(symbols);
    }

    /**
     * Obtiene precios de Binance
     */
    private async fetchFromBinance(symbols: string[]): Promise<Record<string, number>> {
        try {
            const response = await this.httpService
                .get(BINANCE_ENDPOINTS.TICKER_PRICE)
                .pipe(
                    timeout(10000),
                    map(res => res.data),
                    catchError(error => {
                        throw error;
                    })
                )
                .toPromise();

            const result: Record<string, number> = {};

            if (Array.isArray(response)) {
                symbols.forEach(symbol => {
                    const symbolWithUSDT = `${symbol.toUpperCase()}USDT`;
                    const priceData = response.find((p: any) => p.symbol === symbolWithUSDT);

                    if (priceData && priceData.price) {
                        result[symbol] = parseFloat(priceData.price);
                    }
                });
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Obtiene precios de CoinGecko (fallback)
     */
    private async fetchFromCoinGecko(symbols: string[]): Promise<Record<string, number>> {
        try {
            const ids = symbols
                .map(s => this.symbolToCoinGeckoId(s))
                .filter(Boolean)
                .join(',');

            if (!ids) {
                this.logger.warn('No se pudieron mapear símbolos a CoinGecko IDs');
                return {};
            }

            const response = await this.httpService
                .get(BINANCE_ENDPOINTS.BACKUP_PRICE_URL, {
                    params: {
                        ids,
                        vs_currencies: 'usd'
                    }
                })
                .pipe(
                    timeout(10000),
                    map(res => res.data),
                    catchError(error => {
                        this.logger.error('Error en CoinGecko:', error?.message);
                        return of({});
                    })
                )
                .toPromise();

            const result: Record<string, number> = {};

            symbols.forEach(symbol => {
                const id = this.symbolToCoinGeckoId(symbol);
                if (id && response[id]?.usd) {
                    result[symbol] = response[id].usd;
                }
            });

            this.logger.log(`📊 CoinGecko: ${Object.keys(result).length}/${symbols.length} precios`);
            return result;
        } catch (error) {
            this.logger.error('Error crítico en CoinGecko:', error);
            return {};
        }
    }

    /**
     * Mapea símbolo crypto a ID de CoinGecko
     */
    private symbolToCoinGeckoId(symbol: string): string | null {
        const map: Record<string, string> = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'BNB': 'binancecoin',
            'SOL': 'solana',
            'ADA': 'cardano',
            'XRP': 'ripple',
            'DOT': 'polkadot',
            'DOGE': 'dogecoin',
            'MATIC': 'matic-network',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'ATOM': 'cosmos',
            'LTC': 'litecoin',
            'BCH': 'bitcoin-cash',
            'NEAR': 'near',
            'ALGO': 'algorand',
            'FTM': 'fantom',
            'SAND': 'the-sandbox',
            'MANA': 'decentraland',
            'AAVE': 'aave',
            'CRV': 'curve-dao-token',
            'GRT': 'the-graph',
            'ENJ': 'enjincoin',
            'CHZ': 'chiliz',
            'ZIL': 'zilliqa',
            'BAT': 'basic-attention-token',
            'USDT': 'tether',
            'USDC': 'usd-coin'
        };

        return map[symbol.toUpperCase()] || null;
    }

    /**
     * Obtiene precio histórico (mantener implementación existente)
     */
    getHistoricalPriceUSD(symbol: string, timestamp: number): Observable<number> {
        // Tu implementación existente aquí
        // ...
        return of(0); // placeholder
    }

    /**
     * Obtiene ticker 24hr (mantener implementación existente)
     */
    getTicker24hr(symbol?: string): Observable<any> {
        // Tu implementación existente aquí
        // ...
        return of({});
    }

    /**
     * Obtiene el estado del circuit breaker
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }

    /**
     * Resetea el circuit breaker
     */
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}