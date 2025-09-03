import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvestmentModule } from './investment/investment.module';
import { DolarApiModule } from './dolar-api/dolar-api.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    InvestmentModule,
    DolarApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
