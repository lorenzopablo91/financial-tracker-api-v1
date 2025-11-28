import { Injectable, Logger } from '@nestjs/common';
import { Observable, map } from 'rxjs';
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
}