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

    // Calcular CEDEARS con ganancias
    const cedearsData = this.calculateActivoAmountWithGains('CEDEARS', activos, cotizacionCCL.venta);

    // Calcular acciones con ganancias
    const accionesData = this.calculateActivoAmountWithGains('ACCIONES', activos, cotizacionCCL.venta);

    // Calcular crypto
    const totalCrypto = this.calculateCryptoAmount(portfolioBinance);

    // Log de resumen
    this.logger.log(
      `Portfolio calculado - CEDEARS: $${cedearsData.valorizado.toFixed(2)} (${cedearsData.gananciaPorc.toFixed(2)}%), ` +
      `Acciones: $${accionesData.valorizado.toFixed(2)} (${accionesData.gananciaPorc.toFixed(2)}%), ` +
      `Crypto: $${totalCrypto.toFixed(2)}`
    );

    return {
      cedears: {
        valorizado: cedearsData.valorizado,
        gananciaDinero: cedearsData.gananciaDinero,
        gananciaPorc: cedearsData.gananciaPorc
      },
      acciones: {
        valorizado: accionesData.valorizado,
        gananciaDinero: accionesData.gananciaDinero,
        gananciaPorc: accionesData.gananciaPorc
      },
      crypto: totalCrypto,
      total: cedearsData.valorizado + accionesData.valorizado + totalCrypto,
      metadata: {
        iolActivos: activos.length,
        letrasEncontradas: activos.filter(a => a?.titulo?.tipo === 'Letras').length,
        accionesEncontradas: activos.filter(a => a?.titulo?.tipo !== 'Letras').length,
        cryptosEncontradas: portfolioBinance.length,
        cotizacionCCL: cotizacionCCL.venta
      }
    };
  }

  private calculateActivoAmountWithGains(tipo: string, activos: any[], cotizacion: number) {
    const activosFiltrados = activos.filter(activo => {
      const tipoActivo = activo?.titulo?.tipo;
      return tipo === tipoActivo;
    });

    const totales = activosFiltrados.reduce((acc, activo) => {
      const valorizado = Number(activo.valorizado) || 0;
      const gananciaDinero = Number(activo.gananciaDinero) || 0;

      return {
        valorizado: acc.valorizado + valorizado,
        gananciaDinero: acc.gananciaDinero + gananciaDinero
      };
    }, { valorizado: 0, gananciaDinero: 0 });

    const valorizadoDolares = totales.valorizado / cotizacion;
    const gananciaDineroDolares = totales.gananciaDinero / cotizacion;

    // Calcular ganancia porcentual: (valorActual - valorInicial) / valorInicial * 100
    const valorInicial = valorizadoDolares - gananciaDineroDolares;
    const gananciaPorc = valorInicial !== 0 ? (gananciaDineroDolares / valorInicial) * 100 : 0;

    return {
      valorizado: valorizadoDolares,
      gananciaDinero: gananciaDineroDolares,
      gananciaPorc: gananciaPorc
    };
  }

  private calculateCryptoAmount(portfolioBinance: any[]): number {
    return portfolioBinance.reduce((sum, crypto) => {
      const valueUSD = Number(crypto?.valueUSD) || 0;
      return sum + valueUSD;
    }, 0);
  }

  private buildCategoriesResponse(calculations: any) {
    const { cedears, acciones, crypto, total } = calculations;

    const gananciaCrypto = (crypto - 3410); //TODO:
    const gananciaCryptoPorc = (crypto - 3410) / 3410; //TODO:
    const categories = [
      {
        name: 'TOTAL',
        amount: Math.round(total * 100) / 100,
        color: '#000000',
        percentage: 100,
        percentageGain:
          ((cedears.gananciaDinero + acciones.gananciaDinero + gananciaCrypto) /
            (total - cedears.gananciaDinero - acciones.gananciaDinero - gananciaCrypto)) * 100,
        amountGain: cedears.gananciaDinero + acciones.gananciaDinero + gananciaCrypto,
        icon: '',
        type: 'total'
      },
      {
        name: 'CEDEARS',
        amount: Math.round(cedears.valorizado * 100) / 100,
        color: '#4BC0C0',
        percentage: total > 0 ? (cedears.valorizado / total) * 100 : 0,
        percentageGain: cedears.gananciaPorc,
        amountGain: cedears.gananciaDinero,
        icon: 'attach_money',
        type: 'cedears'
      },
      {
        name: 'ACCIONES',
        amount: Math.round(acciones.valorizado * 100) / 100,
        color: '#9966FF',
        percentage: total > 0 ? (acciones.valorizado / total) * 100 : 0,
        percentageGain: acciones.gananciaPorc,
        amountGain: acciones.gananciaDinero,
        icon: 'bar_chart',
        type: 'stocks'
      },
      {
        name: 'CRYPTOMONEDAS',
        amount: Math.round(crypto * 100) / 100,
        color: '#FF9F40',
        percentage: total > 0 ? (crypto / total) * 100 : 0,
        percentageGain: crypto > 0 ? gananciaCryptoPorc * 100 : 0,
        amountGain: gananciaCrypto,
        icon: 'currency_bitcoin',
        type: 'crypto'
      }
    ].map(cat => ({
      ...cat,
      percentage: Math.round(cat.percentage * 10) / 10,
      percentageGain: Math.round(cat.percentageGain * 100) / 100,
      amountGain: cat.amountGain.toFixed(2)
    }));

    return {
      success: true,
      categories,
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