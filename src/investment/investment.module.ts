import { Module } from '@nestjs/common';
import { DolarApiModule } from 'src/dolar-api/dolar-api.module';
import { IolApiModule } from 'src/iol-api/iol-api.module';

// Controllers (endpoints)
import { ExchangeRatesController } from './controllers/exchange-rates/exchange-rates.controller';
import { PortfolioController } from './controllers/portfolio/portfolio.controller';

// Services (lógica de negocio)
import { ExchangeRatesService } from './services/exchange-rates/exchange-rates.service';
import { PortfolioService } from './services/portfolio/portfolio.service';

@Module({
  imports: [
    DolarApiModule,
    IolApiModule
  ],
  controllers: [
    ExchangeRatesController,
    PortfolioController
    
  ],
  providers: [
    ExchangeRatesService,
    PortfolioService
  ],
})
export class InvestmentModule { }