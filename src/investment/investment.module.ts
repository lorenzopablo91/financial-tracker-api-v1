import { Module } from '@nestjs/common';
import { DolarApiModule } from 'src/dolar-api/dolar-api.module';
import { IolApiModule } from 'src/iol-api/iol-api.module';
import { BinanceApiModule } from 'src/binance-api/binance-api.module';

// Controllers (endpoints)
import { HealthController } from './controllers/helth/health.controller';
import { PortfolioController } from './controllers/portfolio/portfolio.controller';
import { CapitalController } from './controllers/portfolio/capital.controller';
import { ValuationController } from './controllers/portfolio/valuation.controller';
import { AssetsController } from './controllers/portfolio/assets.controller';
import { HistoryController } from './controllers/portfolio/history.controller';

// Services (lógica de negocio)
import { PortfolioService } from './services/portfolio/portfolio.service';
import { CapitalService } from './services/portfolio/capital.service';
import { ValuationService } from './services/portfolio/valuation.service';
import { AssetsService } from './services/portfolio/assets.service';
import { HistoryService } from './services/portfolio/history.service';

@Module({
  imports: [
    DolarApiModule,
    IolApiModule,
    BinanceApiModule
  ],
  controllers: [
    HealthController,
    PortfolioController,
    CapitalController,
    ValuationController,
    AssetsController,
    HistoryController
  ],
  providers: [
    PortfolioService,
    CapitalService,
    ValuationService,
    AssetsService,
    HistoryService
  ],
})
export class InvestmentModule { }