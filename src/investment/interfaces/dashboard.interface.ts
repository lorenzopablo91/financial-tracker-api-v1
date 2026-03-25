export interface CryptoDashboardItem {
    symbol: string;
    name: string;
    color: string;
    price: number;
    priceChangePercent: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
}

export interface StockDashboardItem {
    symbol: string;
    name: string;
    tipo: 'Cedear' | 'Accion';
    mercado: string;
    precioLocal: number;
    moneda: 'ARS' | 'USD';
    precioUSD: number;
    variacionPorc: number;
    apertura: number;
    maximo: number;
    minimo: number;
    cierreAnterior: number;
    tendencia: string;
    cotizacionUSD: number;
}

export interface DolarItem {
    tipo: string;
    venta: number;
}

export interface DashboardStreamPayload {
    timestamp: string;
    dolar: DolarItem | null;
    cryptos: CryptoDashboardItem[];
    stocks: StockDashboardItem[];
}