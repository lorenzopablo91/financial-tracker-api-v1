import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DolarComparacion, DolarCotizacion } from 'src/dolar-api/core/interfaces/dolar-response.interface';
import { DolarBaseService } from 'src/dolar-api/core/services/dolar-base/dolar-base.service';

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    private readonly dolarService: DolarBaseService
  ) { }

  // Obtener cotización específica del dólar
  getCotizacionDolar(tipo: string): Observable<DolarCotizacion> {
    this.logger.log(`Obteniendo cotización del dólar ${tipo}...`);
    return this.dolarService.getCotizacionPorTipo(tipo);
  }

  // Obtener todas las cotizaciones con comparación
  getComparacionDolar(): Observable<DolarComparacion> {
    this.logger.log('Obteniendo comparación de todas las cotizaciones...');
    return this.dolarService.getTodasLasCotizaciones();
  }

}