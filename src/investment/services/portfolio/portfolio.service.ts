import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IOL_ENDPOINTS } from '../../../iol-api/core/constants/iol-endpoints';
import { IolBaseService } from '../../../iol-api/core/services/iol-base/iol-base.service';
import { BinanceBaseService } from '../../../binance-api/core/services/binance-base/binance-base.service';
import { CryptoData } from '../../../binance-api/core/interfaces/binance-response.interface';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly iolService: IolBaseService,
    private readonly binanceService: BinanceBaseService,
  ) { }

  // Obtener portafolio USA
  getPortfolioUsa(): Observable<any> {
    this.logger.log('Obteniendo portafolio USA...');
    return this.iolService['get'](IOL_ENDPOINTS.PORTFOLIO_USA);
  }

  // Obtener portafolio Argentina
  getPortfolioArg(): Observable<any> {
    this.logger.log('Obteniendo portafolio Argentina...');
    return this.iolService['get'](IOL_ENDPOINTS.PORTFOLIO_ARG);
  }

  // Obtener precios de crypto específicas
  getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
    this.logger.log(`Obteniendo precios para: ${symbols.join(', ')}`);
    return this.binanceService.getCryptoPrices(symbols);
  }

  // Obtener portafolio de criptomonedas
  getPortfolioCrypto(): Observable<CryptoData[]> {
    this.logger.log('Obteniendo portafolio de criptomonedas...');
    return this.binanceService.getCryptoData();
  }

  // Obtener solo balances de crypto
  getCryptoBalances(): Observable<Record<string, number>> {
    this.logger.log('Obteniendo balances de criptomonedas...');
    return this.binanceService.getAccountBalances();
  }

}