import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BinanceAuthService } from './auth/services/binance-auth/binance-auth.service';
import { BinanceBaseService } from './core/services/binance-base/binance-base.service';

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
    BinanceBaseService,
  ],
  exports: [
    BinanceAuthService,
    BinanceBaseService,
  ],
})
export class BinanceApiModule { }