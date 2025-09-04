import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { IOL_ENDPOINTS } from '../../../iol-api/core/constants/iol-endpoints';
import { IolBaseService } from '../../../iol-api/core/services/iol-base/iol-base.service';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly iolService: IolBaseService
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

}