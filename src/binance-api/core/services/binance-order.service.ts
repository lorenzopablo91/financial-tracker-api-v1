import { Injectable, Logger } from '@nestjs/common';
import { Observable, map, switchMap, forkJoin, of, catchError } from 'rxjs';
import { BinancePriceService } from './binance-price.service';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { BinanceSpotOrders } from '../interfaces/binance-response.interface';
import { BinanceHttpService } from './binance-http.service';

@Injectable()
export class BinanceOrderService {
    private readonly logger = new Logger(BinanceOrderService.name);

    constructor(
        private readonly httpService: BinanceHttpService,
        private readonly priceService: BinancePriceService,
    ) { }

    getFiatOrders(beginDate: string): Observable<BinanceSpotOrders[]> {
        const timestamp = Date.now();
        const transactionType = '0';
        const beginTime = new Date(beginDate).getTime();
        const endTime = Date.now();

        return this.httpService.makeSignedRequest<{ code: string; message: string; data: BinanceSpotOrders[] }>(
            BINANCE_ENDPOINTS.FIAT_ORDERS,
            { timestamp, transactionType, beginTime, endTime }
        ).pipe(
            map((response) => response.data)
        );
    }

    getFiatOrdersAverages(beginDate: string): Observable<Record<string, number>> {
        return this.getFiatOrders(beginDate).pipe(
            map((orders) => {
                const result: Record<string, { totalAmount: number; totalCost: number }> = {};

                orders.forEach((order) => {
                    const crypto = order.cryptoCurrency;
                    const amount = parseFloat(order.obtainAmount);
                    const price = parseFloat(order.price);
                    const cost = amount * price;

                    if (!result[crypto]) {
                        result[crypto] = { totalAmount: 0, totalCost: 0 };
                    }

                    result[crypto].totalAmount += amount;
                    result[crypto].totalCost += cost;
                });

                const averages: Record<string, number> = {};
                Object.keys(result).forEach((crypto) => {
                    const { totalAmount, totalCost } = result[crypto];
                    if (totalAmount > 0) {
                        averages[crypto] = totalCost / totalAmount;
                    }
                });

                return averages;
            })
        );
    }

    getFiatOrdersAveragesUSD(beginDate: string): Observable<Record<string, number>> {
        return this.getFiatOrders(beginDate).pipe(
            switchMap((orders) => {
                if (!orders || orders.length === 0) {
                    this.logger.warn('No orders found for the given period');
                    return of({});
                }

                const observables = orders.map(order => {
                    const crypto = order.cryptoCurrency;
                    const timestamp = order.createTime;
                    const symbol = crypto + 'USDT';

                    return this.priceService.getHistoricalPriceUSD(symbol, timestamp).pipe(
                        map(priceUSD => ({
                            crypto,
                            amount: parseFloat(order.obtainAmount),
                            costUSD: parseFloat(order.obtainAmount) * priceUSD
                        })),
                        catchError(error => {
                            this.logger.error(`Error processing order for ${crypto}:`, error);
                            return of({ crypto, amount: 0, costUSD: 0 });
                        })
                    );
                });

                return forkJoin(observables).pipe(
                    map(results => {
                        const aggregated: Record<string, { totalAmount: number; totalCost: number }> = {};

                        results.forEach(({ crypto, amount, costUSD }) => {
                            if (!aggregated[crypto]) aggregated[crypto] = { totalAmount: 0, totalCost: 0 };
                            aggregated[crypto].totalAmount += amount;
                            aggregated[crypto].totalCost += costUSD;
                        });

                        const averages: Record<string, number> = {};
                        Object.keys(aggregated).forEach(crypto => {
                            const { totalAmount, totalCost } = aggregated[crypto];
                            if (totalAmount > 0) {
                                averages[crypto] = totalCost / totalAmount;
                            }
                        });

                        return averages;
                    })
                );
            }),
            catchError(error => {
                this.logger.error('Error in getFiatOrdersAveragesUSD:', error);
                return of({});
            })
        );
    }
}