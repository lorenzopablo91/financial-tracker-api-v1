import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { BINANCE_ENDPOINTS } from '../constants/binance-endpoints';
import { BinanceHttpService } from './binance-http.service';

@Injectable()
export class BinanceMarketService {
    constructor(private readonly httpService: BinanceHttpService) { }

    getExchangeInfo(): Observable<any> {
        return this.httpService.makePublicRequest(BINANCE_ENDPOINTS.EXCHANGE_INFO);
    }
}