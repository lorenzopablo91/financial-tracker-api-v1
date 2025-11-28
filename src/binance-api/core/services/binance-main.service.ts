import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BinanceAccountService } from './binance-account.service';
import { BinancePriceService } from './binance-price.service';
import { BinanceCryptoService } from './binance-crypto.service';
import { BinanceMarketService } from './binance-market.service';
import { BinanceOrderService } from './binance-order.service';
import { BinanceBaseHelper } from '../helpers/binance-base.helper';
import { BinanceApiResponse, CryptoData, BinanceSpotOrders } from '../interfaces/binance-response.interface';

@Injectable()
export class BinanceMainService {
    constructor(
        private readonly accountService: BinanceAccountService,
        private readonly priceService: BinancePriceService,
        private readonly orderService: BinanceOrderService,
        private readonly cryptoService: BinanceCryptoService,
        private readonly marketService: BinanceMarketService,
    ) { }

    formatResponse<T>(data: T, additionalInfo?: Record<string, any>): BinanceApiResponse<T> {
        return BinanceBaseHelper.formatResponse(data, additionalInfo);
    }

    // ========== DELEGACIÓN A SERVICIOS ESPECÍFICOS ==========

    getAccountBalances(): Observable<Record<string, number>> {
        return this.accountService.getAccountBalances();
    }

    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        return this.priceService.getCryptoPrices(symbols);
    }

    getCryptoData(): Observable<CryptoData[]> {
        return this.cryptoService.getCryptoData();
    }

    getExchangeInfo(): Observable<any> {
        return this.marketService.getExchangeInfo();
    }

    getFiatOrders(beginDate: string): Observable<BinanceSpotOrders[]> {
        return this.orderService.getFiatOrders(beginDate);
    }

    getFiatOrdersAverages(beginDate: string): Observable<Record<string, number>> {
        return this.orderService.getFiatOrdersAverages(beginDate);
    }

    // ========== CIRCUIT BREAKER METHODS ==========

    /**
     * Obtiene el estado del circuit breaker
     */
    getCircuitBreakerState() {
        return this.priceService.getCircuitBreakerState();
    }

    /**
     * Resetea el circuit breaker (solo para admin/debugging)
     */
    resetCircuitBreaker() {
        return this.priceService.resetCircuitBreaker();
    }
}