import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BinanceAuthService } from './auth/services/binance-auth/binance-auth.service';
import { BinanceHttpService } from './core/services/binance-http.service';
import { BinanceTimeService } from './core/services/binance-time.service';
import { BinanceAccountService } from './core/services/binance-account.service';
import { BinancePriceService } from './core/services/binance-price.service';
import { BinanceCryptoService } from './core/services/binance-crypto.service';
import { BinanceMarketService } from './core/services/binance-market.service';
import { BinanceOrderService } from './core/services/binance-order.service';
import { BinanceMainService } from './core/services/binance-main.service';
import { BinanceCircuitBreakerService } from './core/services/binance-circuit-breaker.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  providers: [
    BinanceAuthService,

    BinanceHttpService,
    BinanceTimeService,
    
    BinanceAccountService,
    BinancePriceService,
    BinanceOrderService,
    BinanceCryptoService,
    BinanceMarketService,
    BinanceMainService,
    BinanceCircuitBreakerService
  ],
  exports: [
    BinanceMainService
  ],
})
export class BinanceApiModule { }