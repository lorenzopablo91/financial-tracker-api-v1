import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { PortfolioService } from 'src/investment/services/portfolio/portfolio.service';

@Controller('api/portfolio')
export class PortfolioController {

  constructor(private readonly portfolioService: PortfolioService) { }

  @Get()
  obtenerPortfolio(@Query('beginTime') beginTime: string): Observable<any> {
    return this.portfolioService.getCategories(beginTime);
  }

  @Get('usa')
  obtenerPortfolioUsa(): Observable<any> {
    return this.portfolioService.getPortfolioUsa().pipe(
      map(data => ({
        success: true,
        region: 'USA',
        data,
        timestamp: new Date().toISOString()
      }))
    );
  }

  @Get('argentina')
  obtenerPortfolioArg(): Observable<any> {
    return this.portfolioService.getPortfolioArg().pipe(
      map(data => ({
        success: true,
        region: 'Argentina',
        data,
        timestamp: new Date().toISOString()
      }))
    );
  }

  // ===== ENDPOINTS BINANCE API =====
  @Get('crypto')
  obtenerPortfolioCrypto(): Observable<any> {
    return this.portfolioService.getPortfolioCrypto().pipe(
      map(data => {
        const totalValue = data.reduce((sum, crypto) => sum + crypto.valueUSD, 0);

        return {
          success: true,
          region: 'CRYPTO',
          data,
          summary: {
            totalAssets: data.length,
            totalValueUSD: totalValue
          },
          timestamp: new Date().toISOString()
        };
      }),
      catchError(error => {
        throw new HttpException(
          'Error al obtener portafolio de criptomonedas',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }

  @Get('crypto/balances')
  obtenerBalancesCrypto(): Observable<any> {
    return this.portfolioService.getCryptoBalances().pipe(
      map(data => ({
        success: true,
        type: 'balances',
        data,
        assetCount: Object.keys(data).length,
        timestamp: new Date().toISOString()
      })),
      catchError(error => {
        throw new HttpException(
          'Error al obtener balances de criptomonedas',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }

  @Get('crypto/ordenes')
  obtenerOrdenesCrypto(@Query('beginTime') beginTime: string): Observable<any> {
    return this.portfolioService.getCryptoOrders(beginTime).pipe(
      map(data => ({
        success: true,
        type: 'ordenes',
        data,
        assetCount: Object.keys(data).length,
        timestamp: new Date().toISOString()
      })),
      catchError(error => {
        throw new HttpException(
          'Error al obtener ordenes de criptomonedas',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }


}