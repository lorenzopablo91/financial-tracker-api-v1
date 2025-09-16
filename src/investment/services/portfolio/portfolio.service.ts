import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { IOL_ENDPOINTS } from '../../../iol-api/core/constants/iol-endpoints';
import { IolBaseService } from '../../../iol-api/core/services/iol-base/iol-base.service';
import { DolarBaseService } from '../../../dolar-api/core/services/dolar-base/dolar-base.service';
import { BinanceMainService } from '../../../binance-api/core/services/binance-main.service';
import { CryptoData } from '../../../binance-api/core/interfaces/binance-response.interface';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly dolarBaseService: DolarBaseService,
    private readonly iolService: IolBaseService,
    private readonly binanceService: BinanceMainService,
  ) { }

  // Obtener portafolio total
  getCategories(beginTime: string): Observable<any> {
    return this.fetchPortfolioData(beginTime).pipe(
      map(({ portfolioIOL, cotizacionCCL, portfolioBinance, cryptoOrders }) => {
        this.validateCriticalServices(portfolioIOL, cotizacionCCL);

        const calculations = this.calculatePortfolioAmounts(
          portfolioIOL,
          cotizacionCCL,
          portfolioBinance,
          cryptoOrders
        );

        return this.buildCategoriesResponse(calculations);
      }),
      catchError(this.handleGlobalError.bind(this))
    );
  }

  // Obtener portafolio USA
  getPortfolioUsa(): Observable<any> {
    return this.iolService['get'](IOL_ENDPOINTS.PORTFOLIO_USA);
  }

  // Obtener portafolio Argentina
  getPortfolioArg(): Observable<any> {
    return this.iolService['get'](IOL_ENDPOINTS.PORTFOLIO_ARG);
  }

  // Obtener precios de crypto específicas
  getCryptoPrices(symbols: string[]): Observable<Record<string, number>> {
    return this.binanceService.getCryptoPrices(symbols);
  }

  // Obtener portafolio de criptomonedas
  getPortfolioCrypto(): Observable<CryptoData[]> {
    return this.binanceService.getCryptoData();
  }

  // Obtener solo balances de crypto
  getCryptoBalances(): Observable<Record<string, number>> {
    return this.binanceService.getAccountBalances();
  }

  // Obtener órdenes crypto
  getCryptoOrders(beginDate: string): Observable<Record<string, number>> {
    return this.binanceService.getFiatOrdersAveragesUSD(beginDate);
  }

  // ===== MÉTODOS PRIVADOS =====
  private fetchPortfolioData(beginTime: string): Observable<any> {
    const baseObservables = {
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
    };

    return forkJoin({
      ...baseObservables,
      cryptoOrders: this.binanceService.getFiatOrdersAveragesUSD(beginTime).pipe(
        catchError((error) => {
          this.logger.error('Error obteniendo órdenes crypto:', error);
          return of({});
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

  private calculatePortfolioAmounts(portfolioIOL: any, cotizacionCCL: any, portfolioBinance: any[], cryptoOrders?: Record<string, number>) {
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

    // Calcular crypto con ganancias usando los costos reales
    const cryptoData = this.calculateCryptoAmountWithGains(portfolioBinance, cryptoOrders);

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
      crypto: {
        valorizado: cryptoData.valorActual,
        gananciaDinero: cryptoData.gananciaDinero,
        gananciaPorc: cryptoData.gananciaPorc,
        costoBasis: cryptoData.costoBasis
      },
      total: cedearsData.valorizado + accionesData.valorizado + cryptoData.valorActual,
      metadata: {
        iolActivos: activos.length,
        letrasEncontradas: activos.filter(a => a?.titulo?.tipo === 'Letras').length,
        accionesEncontradas: activos.filter(a => a?.titulo?.tipo !== 'Letras').length,
        cryptosEncontradas: portfolioBinance.length,
        cotizacionCCL: cotizacionCCL.venta,
        cryptoOrdersAvailable: !!cryptoOrders && Object.keys(cryptoOrders).length > 0
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

  private calculateCryptoAmountWithGains(portfolioBinance: any[], cryptoOrders?: Record<string, number>) {
    // Calcular valor actual total
    const valorActual = portfolioBinance.reduce((sum, crypto) => {
      const valueUSD = Number(crypto?.valueUSD) || 0;
      return sum + valueUSD;
    }, 0);

    // Si no hay órdenes de crypto, usar lógica anterior con advertencia
    if (!cryptoOrders || Object.keys(cryptoOrders).length === 0) {
      this.logger.warn('No se encontraron órdenes de crypto, usando costo base estimado');
      return {
        valorActual,
        gananciaDinero: 0,
        gananciaPorc: 0,
        costoBasis: 0
      };
    }

    // Calcular costos
    let costoBasisTotal = 0;
    let cryptosConCosto = 0;
    let cryptosEnPortfolio = 0;

    portfolioBinance.forEach(crypto => {
      const symbol = crypto.symbol;
      const cantidad = Number(crypto.amount) || 0;

      // Solo procesar cryptos con cantidad positiva
      if (cantidad > 0) {
        cryptosEnPortfolio++;
        const precioPromedio = cryptoOrders[symbol];

        if (precioPromedio && precioPromedio > 0) {
          const costoBase = precioPromedio * cantidad;
          costoBasisTotal += costoBase;
          cryptosConCosto++;
        } else {
          this.logger.warn(`❌ ${symbol}: No se encontró precio promedio en las órdenes`);
        }
      } else {
        this.logger.log(`Skipping ${symbol}: cantidad=${cantidad} (zero or negative)`);
      }
    });

    const gananciaDinero = valorActual - costoBasisTotal;
    const gananciaPorc = costoBasisTotal > 0 ? (gananciaDinero / costoBasisTotal) * 100 : 0;

    return {
      valorActual,
      gananciaDinero,
      gananciaPorc,
      costoBasis: costoBasisTotal
    };
  }

  private buildCategoriesResponse(calculations: any) {
    const { cedears, acciones, crypto, total } = calculations;

    const categories = [
      {
        name: 'TOTAL',
        amount: Math.round(total * 100) / 100,
        color: '#000000',
        percentage: 100,
        percentageGain:
          ((cedears.gananciaDinero + acciones.gananciaDinero + crypto.gananciaDinero) /
            (total - cedears.gananciaDinero - acciones.gananciaDinero - crypto.gananciaDinero)) * 100,
        amountGain: cedears.gananciaDinero + acciones.gananciaDinero + crypto.gananciaDinero,
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
        amount: Math.round(crypto.valorizado * 100) / 100,
        color: '#FF9F40',
        percentage: total > 0 ? (crypto.valorizado / total) * 100 : 0,
        percentageGain: crypto.gananciaPorc,
        amountGain: crypto.gananciaDinero,
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
        cryptoCostBasis: crypto.costoBasis,
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

}