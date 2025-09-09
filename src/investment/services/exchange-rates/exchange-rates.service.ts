import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DolarComparacion, DolarCotizacion } from 'src/dolar-api/core/interfaces/dolar-response.interface';
import { DolarBaseService } from 'src/dolar-api/core/services/dolar-base/dolar-base.service';

@Injectable()
export class ExchangeRatesService {

  constructor(
    private readonly dolarService: DolarBaseService
  ) { }

  // Obtener cotización específica del dólar
  getCotizacionDolar(tipo: string): Observable<DolarCotizacion> {
    return this.dolarService.getCotizacionPorTipo(tipo);
  }

  // Obtener todas las cotizaciones con comparación
  getComparacionDolar(): Observable<DolarComparacion> {
    return this.dolarService.getTodasLasCotizaciones();
  }

}