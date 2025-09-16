import { Injectable } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { BinanceHttpService } from './binance-http.service';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { BinanceAccountBalance } from '../interfaces/binance-response.interface';

@Injectable()
export class BinanceAccountService {
    constructor(private readonly httpService: BinanceHttpService) { }

    getAccountBalances(): Observable<Record<string, number>> {
        return this.httpService.makeSignedRequest<{ balances: BinanceAccountBalance[] }>(
            BINANCE_ENDPOINTS.ACCOUNT_INFO
        ).pipe(
            map((response) => {
                const balances: Record<string, number> = {};
                response.balances.forEach((balance) => {
                    const total = parseFloat(balance.free) + parseFloat(balance.locked);
                    if (total > 0) balances[balance.asset] = total;
                });
                return balances;
            }),
        );
    }
}