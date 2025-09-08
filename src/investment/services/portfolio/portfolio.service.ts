import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { IOL_ENDPOINTS } from '../../../iol-api/core/constants/iol-endpoints';
import { IolBaseService } from '../../../iol-api/core/services/iol-base/iol-base.service';
import { DolarBaseService } from '../../../dolar-api/core/services/dolar-base/dolar-base.service';
import { BinanceBaseService } from '../../../binance-api/core/services/binance-base/binance-base.service';
import { CryptoData } from '../../../binance-api/core/interfaces/binance-response.interface';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly dolarBaseService: DolarBaseService,
    private readonly iolService: IolBaseService,
    private readonly binanceService: BinanceBaseService,
  ) { }

  getCategories(): Observable<any> {
    return this.fetchPortfolioData().pipe(
      map(({ portfolioIOL, cotizacionCCL, portfolioBinance }) => {
        this.validateCriticalServices(portfolioIOL, cotizacionCCL);

        const calculations = this.calculatePortfolioAmounts(
          portfolioIOL,
          cotizacionCCL,
          portfolioBinance
        );

        return this.buildCategoriesResponse(calculations);
      }),
      catchError(this.handleGlobalError.bind(this))
    );
  }

  // ===== MÉTODOS PRIVADOS =====
  private fetchPortfolioData(): Observable<any> {
    return forkJoin({
      portfolioIOL: this.getPortfolioArg().pipe(
        catchError((error) => {
          this.logger.error('Error obteniendo portfolio IOL:', error);
          return of(null);
        })
      ),
      cotizacionCCL: this.dolarBaseService.getCotizacionPorTipo('ccl').pipe(
        catchError((error) => {
          this.logger.error('Error obteniendo cotización CCL:', error);
          return of(null);
        })
      ),
      portfolioBinance: this.binanceService.getCryptoData().pipe(
        catchError((error) => {
          this.logger.error('Error obteniendo portfolio Binance:', error);
          return of([]);
        })
      )
    });
  }

  private validateCriticalServices(portfolioIOL: any, cotizacionCCL: any): void {
    const serviciosFallidos: string[] = [];

    if (!portfolioIOL) serviciosFallidos.push('IOL Portfolio');
    if (!cotizacionCCL) serviciosFallidos.push('Cotización CCL');

    if (serviciosFallidos.length > 0) {
      throw new HttpException(
        `Servicios no disponibles: ${serviciosFallidos.join(', ')}`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    if (!Array.isArray(portfolioIOL?.activos)) {
      throw new HttpException(
        'Portfolio IOL no contiene activos válidos',
        HttpStatus.BAD_GATEWAY
      );
    }

    if (!cotizacionCCL.venta || cotizacionCCL.venta <= 0) {
      throw new HttpException(
        'Cotización CCL inválida',
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  private calculatePortfolioAmounts(portfolioIOL: any, cotizacionCCL: any, portfolioBinance: any[]) {
    const activos = portfolioIOL.activos;

    // Validar portfolio Binance
    if (!Array.isArray(portfolioBinance)) {
      this.logger.warn('Portfolio Binance no es un array válido, usando array vacío');
      portfolioBinance = [];
    }

    // Calcular dólares (letras)
    const totalLetrasDolares = this.calculateLetrasAmount(activos, cotizacionCCL.venta);

    // Calcular acciones (no letras)
    const totalAccionesDolares = this.calculateAccionesAmount(activos, cotizacionCCL.venta);

    // Calcular crypto
    const totalCrypto = this.calculateCryptoAmount(portfolioBinance);

    // Log de resumen
    this.logger.log(
      `Portfolio calculado - Dólares: $${totalLetrasDolares.toFixed(2)}, ` +
      `Acciones: $${totalAccionesDolares.toFixed(2)}, Crypto: $${totalCrypto.toFixed(2)}`
    );

    return {
      dolares: totalLetrasDolares,
      acciones: totalAccionesDolares,
      crypto: totalCrypto,
      total: totalLetrasDolares + totalAccionesDolares + totalCrypto,
      metadata: {
        iolActivos: activos.length,
        letrasEncontradas: activos.filter(a => a?.titulo?.tipo === 'Letras').length,
        accionesEncontradas: activos.filter(a => a?.titulo?.tipo !== 'Letras').length,
        cryptosEncontradas: portfolioBinance.length,
        cotizacionCCL: cotizacionCCL.venta
      }
    };
  }

  private calculateLetrasAmount(activos: any[], cotizacionCCL: number): number {
    const letrasActivo = activos.filter(activo =>
      activo?.titulo?.tipo === 'Letras'
    );

    const totalLetrasPesos = letrasActivo.reduce((total, activo) => {
      const valorizado = Number(activo?.valorizado) || 0;
      return total + valorizado;
    }, 0);

    return totalLetrasPesos / cotizacionCCL;
  }

  private calculateAccionesAmount(activos: any[], cotizacionCCL: number): number {
    const accionesActivo = activos.filter(activo =>
      activo?.titulo?.tipo !== 'Letras'
    );

    const totalAccionesPesos = accionesActivo.reduce((total, activo) => {
      const valorizado = Number(activo?.valorizado) || 0;
      return total + valorizado;
    }, 0);

    return totalAccionesPesos / cotizacionCCL;
  }

  private calculateCryptoAmount(portfolioBinance: any[]): number {
    return portfolioBinance.reduce((sum, crypto) => {
      const valueUSD = Number(crypto?.valueUSD) || 0;
      return sum + valueUSD;
    }, 0);
  }

  private buildCategoriesResponse(calculations: any) {
    const { dolares, acciones, crypto, total } = calculations;

    const categories = [
      {
        name: 'DÓLARES',
        amount: Math.round(dolares * 100) / 100,
        color: '#4BC0C0',
        percentage: total > 0 ? (dolares / total) * 100 : 0,
        uninvested: 1704
      },
      {
        name: 'ACCIONES',
        amount: Math.round(acciones * 100) / 100,
        color: '#9966FF',
        percentage: total > 0 ? (acciones / total) * 100 : 0,
        uninvested: 3410
      },
      {
        name: 'CRYPTOMONEDAS',
        amount: Math.round(crypto * 100) / 100,
        color: '#FF9F40',
        percentage: total > 0 ? (crypto / total) * 100 : 0,
        uninvested: 3410
      }
    ].map(cat => ({
      ...cat,
      percentage: Math.round(cat.percentage * 10) / 10
    }));

    // Calcular total sin invertir
    const totalUninvested = categories.reduce((sum, cat) => sum + cat.uninvested, 0);

    return {
      success: true,
      categories,
      total: Math.round(calculations.total * 100) / 100,
      totalUninvested,
      metadata: {
        ...calculations.metadata,
        timestamp: new Date().toISOString()
      }
    };
  }

  private handleGlobalError(error: any): Observable<never> {
    this.logger.error('Error crítico en getCategories:', error);

    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(
      'Servicio temporalmente no disponible',
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }

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