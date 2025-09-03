export interface DolarCotizacion {
  moneda: string;
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export interface DolarApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  source: string;
  [key: string]: any;
}

export interface DolarResumen {
  tipo: string;
  nombre: string;
  compra: number;
  venta: number;
  spread: number;
  spreadPercent: number;
  fechaActualizacion: string;
  color: string;
  description: string;
}

export interface DolarComparacion {
  cotizaciones: DolarResumen[];
  mayorVenta: DolarResumen;
  menorVenta: DolarResumen;
  timestamp: string;
}
