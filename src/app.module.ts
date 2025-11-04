import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InvestmentModule } from './investment/investment.module';
import { DolarApiModule } from './dolar-api/dolar-api.module';
import { IolApiModule } from './iol-api/iol-api.module';
import { BinanceApiModule } from './binance-api/binance-api.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    InvestmentModule,
    DolarApiModule,
    IolApiModule,
    BinanceApiModule,
    PrismaModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
