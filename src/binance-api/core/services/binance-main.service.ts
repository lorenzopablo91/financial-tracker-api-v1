import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
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

    // Delegación a servicios específicos
    getAccountBalances(): Observable<Record<string, number>> {
        return this.accountService.getAccountBalances();
    }

    getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
        return from(this.priceService.getCryptoPrices(symbols));
    }

    getCryptoData(): Observable<CryptoData[]> {
        return this.cryptoService.getCryptoData();
    }

    getExchangeInfo(): Observable<any> {
        return this.marketService.getExchangeInfo();
    }

    getTicker24hr(symbol?: string): Observable<any> {
        return this.priceService.getTicker24hr(symbol);
    }

    getFiatOrders(beginDate: string): Observable<BinanceSpotOrders[]> {
        return this.orderService.getFiatOrders(beginDate);
    }

    getFiatOrdersAverages(beginDate: string): Observable<Record<string, number>> {
        return this.orderService.getFiatOrdersAverages(beginDate);
    }

    getFiatOrdersAveragesUSD(beginDate: string): Observable<Record<string, number>> {
        return this.orderService.getFiatOrdersAveragesUSD(beginDate);
    }

    getHistoricalPriceUSD(symbol: string, timestamp: number): Observable<number> {
        return this.priceService.getHistoricalPriceUSD(symbol, timestamp);
    }
}