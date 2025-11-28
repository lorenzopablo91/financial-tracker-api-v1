import { Injectable, Logger } from '@nestjs/common';
import { timeout, catchError, map } from 'rxjs/operators';
import { of, Observable, from, firstValueFrom } from 'rxjs';
import { BinanceCircuitBreakerService } from './binance-circuit-breaker.service';
import { BinanceHttpService } from './binance-http.service';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class BinancePriceService {
    private readonly logger = new Logger(BinancePriceService.name);

    // Cache para CoinGecko
    private coingeckoCache: {
        data: Record<string, number>;
        timestamp: number;
    } | null = null;
    private readonly COINGECKO_CACHE_TTL = 60000; // 1 minuto

    constructor(
        private readonly binanceHttpService: BinanceHttpService,
        private readonly httpService: HttpService,
        private readonly circuitBreaker: BinanceCircuitBreakerService
    ) { }

    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        if (symbols.length === 0) {
            return of({});
        }

        return from(this.getCryptoPricesInternal(symbols));
    }

    private async getCryptoPricesInternal(symbols: string[]): Promise<Record<string, number>> {
        // 1. Intentar Binance
        if (this.circuitBreaker.canMakeRequest()) {
            try {
                const prices = await this.fetchFromBinance(symbols);

                if (Object.keys(prices).length > 0) {
                    this.circuitBreaker.recordSuccess();
                    this.logger.log(`✅ Binance: ${Object.keys(prices).length}/${symbols.length} precios`);
                    return prices;
                }

                this.logger.warn('⚠️ Binance no retornó precios, usando fallback');
            } catch (error) {
                this.circuitBreaker.recordFailure(error);
                const errorMsg = error?.message || error?.response?.data?.msg || 'Unknown error';
                this.logger.error('❌ Error en Binance, usando fallback:', errorMsg);
            }
        } else {
            const state = this.circuitBreaker.getState();
            this.logger.warn(
                `🚫 Binance bloqueado (${state.state}) - usando CoinGecko directamente`
            );
        }

        // 2. Fallback a CoinGecko con cache
        return await this.fetchFromCoinGeckoWithCache(symbols);
    }

    /**
     * ✅ Usa BinanceHttpService que tiene baseURL configurado
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
                        this.logger.debug(`Price not found in Binance for ${symbol}`);
                    }
                });
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * CoinGecko con cache - usa HttpService directo porque es externa
     */
    private async fetchFromCoinGeckoWithCache(symbols: string[]): Promise<Record<string, number>> {
        const now = Date.now();

        // Verificar cache
        if (this.coingeckoCache && (now - this.coingeckoCache.timestamp) < this.COINGECKO_CACHE_TTL) {
            this.logger.log('⚡ Usando cache de CoinGecko');
            return this.filterCachedPrices(this.coingeckoCache.data, symbols);
        }

        try {
            const allPrices = await this.fetchAllPricesFromCoinGecko();

            if (Object.keys(allPrices).length > 0) {
                this.coingeckoCache = {
                    data: allPrices,
                    timestamp: now
                };
                this.logger.log(`📊 CoinGecko actualizado: ${Object.keys(allPrices).length} precios en cache`);
                return this.filterCachedPrices(allPrices, symbols);
            }
        } catch (error) {
            const errorMsg = error?.message || 'Unknown error';
            this.logger.error('Error en CoinGecko:', errorMsg);

            if (this.coingeckoCache) {
                this.logger.warn('⚠️ Usando cache vencido de CoinGecko');
                return this.filterCachedPrices(this.coingeckoCache.data, symbols);
            }
        }

        this.logger.error('❌ No hay datos disponibles de ninguna fuente');
        return {};
    }

    private async fetchAllPricesFromCoinGecko(): Promise<Record<string, number>> {
        try {
            const allIds = [
                'bitcoin', 'ethereum', 'binancecoin', 'solana', 'cardano',
                'ripple', 'polkadot', 'dogecoin', 'matic-network', 'avalanche-2',
                'chainlink', 'uniswap', 'cosmos', 'litecoin', 'bitcoin-cash',
                'near', 'algorand', 'fantom', 'the-sandbox', 'decentraland',
                'aave', 'curve-dao-token', 'the-graph', 'enjincoin', 'chiliz',
                'zilliqa', 'basic-attention-token', 'tether', 'usd-coin'
            ].join(',');

            const response = await firstValueFrom(
                this.httpService.get(BINANCE_ENDPOINTS.COINGECKO_SIMPLE_PRICE, {
                    params: {
                        ids: allIds,
                        vs_currencies: 'usd'
                    }
                }).pipe(
                    timeout(15000),
                    map(res => res.data),
                    catchError(error => {
                        const status = error?.response?.status;
                        if (status === 429) {
                            this.logger.error('🚫 Rate limit en CoinGecko - cache requerido');
                        }
                        throw error;
                    })
                )
            );

            const idToSymbol = this.getIdToSymbolMap();
            const result: Record<string, number> = {};

            Object.entries(response).forEach(([id, data]: [string, any]) => {
                const symbol = idToSymbol[id];
                if (symbol && data?.usd) {
                    result[symbol] = data.usd;
                }
            });

            return result;
        } catch (error) {
            throw error;
        }
    }

    private filterCachedPrices(allPrices: Record<string, number>, symbols: string[]): Record<string, number> {
        const result: Record<string, number> = {};

        symbols.forEach(symbol => {
            const symbolUpper = symbol.toUpperCase();
            if (allPrices[symbolUpper]) {
                result[symbol] = allPrices[symbolUpper];
            } else if (allPrices[symbol]) {
                result[symbol] = allPrices[symbol];
            }
        });

        this.logger.log(`💎 Retornando ${Object.keys(result).length}/${symbols.length} precios del cache`);
        return result;
    }

    private getIdToSymbolMap(): Record<string, string> {
        return {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'binancecoin': 'BNB',
            'solana': 'SOL',
            'cardano': 'ADA',
            'ripple': 'XRP',
            'polkadot': 'DOT',
            'dogecoin': 'DOGE',
            'matic-network': 'MATIC',
            'avalanche-2': 'AVAX',
            'chainlink': 'LINK',
            'uniswap': 'UNI',
            'cosmos': 'ATOM',
            'litecoin': 'LTC',
            'bitcoin-cash': 'BCH',
            'near': 'NEAR',
            'algorand': 'ALGO',
            'fantom': 'FTM',
            'the-sandbox': 'SAND',
            'decentraland': 'MANA',
            'aave': 'AAVE',
            'curve-dao-token': 'CRV',
            'the-graph': 'GRT',
            'enjincoin': 'ENJ',
            'chiliz': 'CHZ',
            'zilliqa': 'ZIL',
            'basic-attention-token': 'BAT',
            'tether': 'USDT',
            'usd-coin': 'USDC'
        };
    }

    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }

    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }

    clearCache() {
        this.coingeckoCache = null;
        this.logger.log('🗑️ Cache de CoinGecko limpiado');
    }
}