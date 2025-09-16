import { Injectable } from '@nestjs/common';
import { Observable, switchMap, map, of } from 'rxjs';
import { BinanceAccountService } from './binance-account.service';
import { BinancePriceService } from './binance-price.service';
import { CRYPTO_METADATA } from '../constants/binance-endpoints';
import { CryptoData } from '../interfaces/binance-response.interface';

@Injectable()
export class BinanceCryptoService {
    private readonly MIN_USD_VALUE = 1;

    constructor(
        private readonly accountService: BinanceAccountService,
        private readonly priceService: BinancePriceService,
    ) { }

    getCryptoData(): Observable<CryptoData[]> {
        return this.accountService.getAccountBalances().pipe(
            switchMap((balances) => {
                const symbols = Object.keys(balances);
                if (symbols.length === 0) return of([]);

                return this.priceService.getCryptoPrices(symbols).pipe(
                    map((prices) => {
                        const cryptoData = symbols
                            .filter((s) => CRYPTO_METADATA[s as keyof typeof CRYPTO_METADATA])
                            .map((s) => {
                                const amount = balances[s];
                                const priceUSD = prices[s] || 0;
                                const valueUSD = amount * priceUSD;
                                const metadata = CRYPTO_METADATA[s as keyof typeof CRYPTO_METADATA];
                                return {
                                    name: metadata.name,
                                    symbol: s,
                                    amount,
                                    priceUSD,
                                    valueUSD,
                                    color: metadata.color
                                } as CryptoData;
                            })
                            .filter((c) => c.valueUSD >= this.MIN_USD_VALUE)
                            .sort((a, b) => b.valueUSD - a.valueUSD);

                        return cryptoData;
                    }),
                );
            }),
        );
    }
}