import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { BinanceHttpService } from './binance-http.service';
import { BinanceServerTimeResponse } from '../interfaces/binance-response.interface';

@Injectable()
export class BinanceTimeService implements OnModuleInit {
    private readonly logger = new Logger(BinanceTimeService.name);
    private serverTimeOffset = 0;

    constructor(private readonly httpService: BinanceHttpService) { }

    onModuleInit() {
        this.syncServerTime();
    }

    private syncServerTime(): void {
        this.getServerTime().subscribe({
            next: (serverTime) => {
                this.serverTimeOffset = serverTime - Date.now();
            },
            error: (error) => this.logger.warn('Failed to sync server time:', error),
        });
    }

    private getServerTime(): Observable<number> {
        return this.httpService.makePublicRequest<BinanceServerTimeResponse>('/api/v3/time').pipe(
            map((response) => response.serverTime),
        );
    }

    getServerTimeOffset(): number {
        return this.serverTimeOffset;
    }
}