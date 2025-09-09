import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable, forkJoin, map, catchError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { DOLAR_ENDPOINTS, DOLAR_TYPES, DOLAR_METADATA } from '../../constants/dolar-endpoints';
import {
  DolarCotizacion,
  DolarComparacion,
  DolarResumen,
} from '../../interfaces/dolar-response.interface';
import { DolarApiHelper } from '../../helpers/dolar-api.helper';

@Injectable()
export class DolarBaseService {
  private readonly logger = new Logger(DolarBaseService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.baseUrl = this.configService.get<string>('DOLAR_API_URL') || '';
  }

  // === Genérico para cualquier tipo de dólar ===
  getCotizacionPorTipo(tipo: string): Observable<DolarCotizacion> {
    const endpoint = DOLAR_ENDPOINTS[tipo as keyof typeof DOLAR_ENDPOINTS];
    if (!endpoint) {
      throw new HttpException(`Tipo de dólar no válido: ${tipo}`, HttpStatus.BAD_REQUEST);
    }

    const url = `${this.baseUrl}${endpoint}`;

    return this.httpService.get<DolarCotizacion>(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DolarAPI-Client/1.0',
      },
    }).pipe(
      map((res: AxiosResponse<DolarCotizacion>) => res.data),
      catchError(DolarApiHelper.handleError),
    );
  }

  // === Obtener todas las cotizaciones en paralelo ===
  getTodasLasCotizaciones(): Observable<DolarComparacion> {
    const tipos = Object.values(DOLAR_TYPES);

    const requests = tipos.map(tipo => this.getCotizacionPorTipo(tipo));

    return forkJoin(requests).pipe(
      map(cots => {
        const cotizaciones: DolarResumen[] = cots.map(cot => {
          const spread = cot.venta - cot.compra;
          const spreadPercent = (spread / cot.compra) * 100;
          const metadata = DOLAR_METADATA[cot.casa as keyof typeof DOLAR_METADATA];

          return {
            tipo: cot.casa,
            nombre: metadata?.name || cot.nombre,
            compra: cot.compra,
            venta: cot.venta,
            spread,
            spreadPercent,
            fechaActualizacion: cot.fechaActualizacion,
            color: metadata?.color || '#6c757d',
            description: metadata?.description || '',
          };
        });

        const mayorVenta = cotizaciones.reduce((max, cot) => cot.venta > max.venta ? cot : max);
        const menorVenta = cotizaciones.reduce((min, cot) => cot.venta < min.venta ? cot : min);

        return {
          cotizaciones: cotizaciones.sort((a, b) => b.venta - a.venta),
          mayorVenta,
          menorVenta,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
