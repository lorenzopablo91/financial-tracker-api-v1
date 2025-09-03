import { Module } from '@nestjs/common';
import { DolarApiModule } from 'src/dolar-api/dolar-api.module';

// Controllers (endpoints)
import { ExchangeRatesController } from './controllers/exchange-rates/exchange-rates.controller';

// Services (lógica de negocio)
import { ExchangeRatesService } from './services/exchange-rates/exchange-rates.service';

@Module({
  imports: [
    DolarApiModule
  ],
  controllers: [
    ExchangeRatesController
  ],
  providers: [
    ExchangeRatesService
  ],
})
export class InvestmentModule { }