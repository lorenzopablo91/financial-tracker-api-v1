import { Module } from '@nestjs/common';
import { DolarApiModule } from 'src/dolar-api/dolar-api.module';
import { IolApiModule } from 'src/iol-api/iol-api.module';
import { BinanceApiModule } from 'src/binance-api/binance-api.module';

// Controllers (endpoints)
import { HealthController } from './controllers/helth/health.controller';
import { PortfolioController } from './controllers/portfolio/portfolio.controller';

// Services (lógica de negocio)
import { PortfolioService } from './services/portfolio/portfolio.service';

@Module({
  imports: [
    DolarApiModule,
    IolApiModule,
    BinanceApiModule
  ],
  controllers: [
    HealthController,
    PortfolioController
  ],
  providers: [
    PortfolioService
  ],
})
export class InvestmentModule { }