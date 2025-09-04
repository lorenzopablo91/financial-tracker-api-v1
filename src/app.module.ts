import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InvestmentModule } from './investment/investment.module';
import { DolarApiModule } from './dolar-api/dolar-api.module';
import { IolApiModule } from './iol-api/iol-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    InvestmentModule,
    DolarApiModule,
    IolApiModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
