import { Controller, Get, HttpException, HttpStatus, Param, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ExchangeRatesService } from 'src/investment/services/exchange-rates/exchange-rates.service';
import { PortfolioService } from 'src/investment/services/portfolio/portfolio.service';

@Controller('api/exchange-rates')
export class ExchangeRatesController {

  constructor(
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly portfolioService: PortfolioService,
  ) { }

  // ===== ENDPOINTS DOLAR API =====
  @Get('dolar')
  obtenerCotizacionesDolar(): Observable<any> {
    return this.exchangeRatesService.getComparacionDolar().pipe(
      map(data => ({
        success: true,
        type: 'todas_las_cotizaciones',
        data,
        timestamp: new Date().toISOString()
      })),
      catchError(error => {
        throw new HttpException(
          'Error al obtener todas las cotizaciones del dólar',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }

  @Get('dolar/:tipo')
  obtenerCotizacionPorTipo(@Param('tipo') tipo: string): Observable<any> {
    const tiposValidos = ['oficial', 'blue', 'mep', 'ccl', 'cripto', 'tarjeta'];

    if (!tiposValidos.includes(tipo.toLowerCase())) {
      throw new HttpException(
        `Tipo de dólar no válido. Tipos disponibles: ${tiposValidos.join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }

    return this.exchangeRatesService.getCotizacionDolar(tipo.toLowerCase()).pipe(
      map(data => ({
        success: true,
        type: `cotizacion_${tipo.toLowerCase()}`,
        data,
        timestamp: new Date().toISOString()
      })),
      catchError(error => {
        throw new HttpException(
          `Error al obtener cotización del dólar ${tipo}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }

  // ===== ENDPOINTS BINANCE API =====
  @Get('crypto/prices')
  obtenerPreciosCrypto(@Query('symbols') symbols: string): Observable<any> {
    if (!symbols) {
      throw new HttpException(
        'Parameter symbols is required. Example: ?symbols=BTC,ETH,ADA',
        HttpStatus.BAD_REQUEST
      );
    }

    const symbolsArray = symbols.split(',').map(s => s.trim().toUpperCase());

    return this.portfolioService.getCryptoPrices(symbolsArray).pipe(
      map(data => ({
        success: true,
        type: 'prices',
        requestedSymbols: symbolsArray,
        data,
        priceCount: Object.keys(data).length,
        timestamp: new Date().toISOString()
      })),
      catchError(error => {
        throw new HttpException(
          'Error al obtener precios de criptomonedas',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      })
    );
  }

}