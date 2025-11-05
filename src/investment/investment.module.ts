import { Module } from '@nestjs/common';
import { DolarApiModule } from 'src/dolar-api/dolar-api.module';
import { IolApiModule } from 'src/iol-api/iol-api.module';
import { BinanceApiModule } from 'src/binance-api/binance-api.module';

// Controllers (endpoints)
import { HealthController } from './controllers/helth/health.controller';
import { AbmController } from './controllers/portfolio/abm.controller';
import { CapitalController } from './controllers/portfolio/capital.controller';
import { ValuacionController } from './controllers/portfolio/valuacion.controller';

// Services (lógica de negocio)
import { AbmService } from './services/portfolio/abm.service';
import { CapitalService } from './services/portfolio/capital.service';
import { ValuacionService } from './services/portfolio/valuacion.service';

@Module({
  imports: [
    DolarApiModule,
    IolApiModule,
    BinanceApiModule
  ],
  controllers: [
    HealthController,
    AbmController,
    CapitalController,
    ValuacionController
  ],
  providers: [
    AbmService,
    CapitalService,
    ValuacionService
  ],
})
export class InvestmentModule { }