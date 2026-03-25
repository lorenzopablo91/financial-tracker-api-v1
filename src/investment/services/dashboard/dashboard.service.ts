import { Injectable, Logger } from '@nestjs/common';
import { Observable, from, map, timer, switchMap } from 'rxjs';
import { PrismaService } from 'prisma/prisma.service';
import { BinanceMainService } from 'src/binance-api/core/services/binance-main.service';
import { DolarBaseService } from 'src/dolar-api/core/services/dolar-base/dolar-base.service';
import { IolBaseService } from 'src/iol-api/core/services/iol-base/iol-base.service';
import { CryptoDashboardItem, DashboardStreamPayload, DolarItem, StockDashboardItem } from 'src/investment/interfaces/dashboard.interface';
import { IOL_ENDPOINTS } from 'src/iol-api/core/constants/iol-endpoints';
import { IOL_MARKETS } from 'src/iol-api/core/constants/iol-markets';
import { CRYPTO_METADATA } from 'src/binance-api/core/constants/binance-endpoints';


@Injectable()
export class DashboardService {

    private readonly logger = new Logger(DashboardService.name);
    private readonly STREAM_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

    constructor(
        private readonly prisma: PrismaService,
        private readonly binanceService: BinanceMainService,
        private readonly iolService: IolBaseService,
        private readonly dolarService: DolarBaseService,
    ) { }

    // ===== STREAM UNIFICADO =====

    /**
     * Stream SSE unificado: cryptos + stocks + dólar de todos los portafolios.
     * Emite inmediatamente y refresca cada 5 minutos.
     */
    getDashboardStream(): Observable<DashboardStreamPayload> {
        this.logger.log(`Iniciando stream unificado (intervalo: ${this.STREAM_INTERVAL_MS / 1000 / 60}min)`);
        return timer(0, this.STREAM_INTERVAL_MS).pipe(
            switchMap(() => from(this.getDashboardPayload()))
        );
    }

    private async getDashboardPayload(): Promise<DashboardStreamPayload> {
        this.logger.log('🔄 Actualizando dashboard stream...');

        // 1. Obtener todos los activos de todos los portafolios (sin duplicados)
        const { cryptoSymbols, stockActivos } = await this.obtenerActivosUnicos();

        // 2. Lanzar todo en paralelo
        const [cryptos, stocks, dolar] = await Promise.all([
            this.obtenerCryptos(cryptoSymbols),
            this.obtenerStocks(stockActivos),
            this.obtenerDolar(),
        ]);

        this.logger.log(`✅ Stream payload: ${cryptos.length} cryptos, ${stocks.length} stocks`);

        return {
            timestamp: new Date().toISOString(),
            dolar,
            cryptos,
            stocks,
        };
    }

    private async obtenerActivosUnicos(): Promise<{
        cryptoSymbols: string[];
        stockActivos: { prefijo: string; nombre: string; tipo: string }[];
    }> {
        const portafolios = await this.prisma.portafolio.findMany({
            include: {
                activos: true,
                _count: {
                    select: {
                        operaciones: true,
                        snapshots: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const cryptoSet = new Set<string>();
        const stockMap = new Map<string, { prefijo: string; nombre: string; tipo: string }>();

        for (const portafolio of portafolios) {
            for (const activo of portafolio.activos) {
                if (Number(activo.cantidad) <= 0) continue;

                if (activo.tipo === 'Criptomoneda') {
                    cryptoSet.add(activo.prefijo.toUpperCase());
                } else if (activo.tipo === 'Accion' || activo.tipo === 'Cedear') {
                    if (!stockMap.has(activo.prefijo)) {
                        stockMap.set(activo.prefijo, {
                            prefijo: activo.prefijo,
                            nombre: activo.nombre,
                            tipo: activo.tipo,
                        });
                    }
                }
            }
        }

        return {
            cryptoSymbols: Array.from(cryptoSet),
            stockActivos: Array.from(stockMap.values()),
        };
    }

    private async obtenerCryptos(symbols: string[]): Promise<CryptoDashboardItem[]> {
        if (symbols.length === 0) return [];

        try {
            const tickers = await this.binanceService.getCryptoTickers(symbols).toPromise();
            return this.mapCryptoTickers(symbols, tickers ?? {});
        } catch (error) {
            this.logger.error('Error obteniendo cryptos:', error?.message);
            return [];
        }
    }

    private async obtenerStocks(
        activos: { prefijo: string; nombre: string; tipo: string }[]
    ): Promise<StockDashboardItem[]> {
        if (activos.length === 0) return [];

        const tieneAcciones = activos.some(a => a.tipo === 'Accion');
        const cotizacionUSD = tieneAcciones ? await this.obtenerCotizacionUSD() : 0;

        const BATCH_SIZE = 3;
        const DELAY_MS = 400;
        const items: StockDashboardItem[] = [];

        for (let i = 0; i < activos.length; i += BATCH_SIZE) {
            const lote = activos.slice(i, i + BATCH_SIZE);

            const resultados = await Promise.allSettled(
                lote.map(activo => this.obtenerCotizacionIOL(activo, cotizacionUSD))
            );

            resultados.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    items.push(result.value);
                } else if (result.status === 'rejected') {
                    this.logger.warn(`❌ Error cotización ${lote[index].prefijo}: ${result.reason?.message}`);
                }
            });

            if (i + BATCH_SIZE < activos.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        return items;
    }

    private async obtenerDolar(): Promise<DolarItem | null> {
        try {
            const cotizacion = await this.dolarService.getCotizacionPorTipo('mep').toPromise();
            if (!cotizacion) return null;
            return {
                tipo: 'MEP',
                venta: cotizacion.venta ?? 0,
            };
        } catch (error) {
            this.logger.error('Error obteniendo dólar:', error?.message);
            return null;
        }
    }

    private async obtenerCotizacionUSD(): Promise<number> {
        try {
            const cotizacion = await this.dolarService.getCotizacionPorTipo('mep').toPromise();
            return cotizacion?.venta || 0;
        } catch (error) {
            this.logger.error('Error obteniendo cotización USD:', error);
            return 0;
        }
    }

    private async obtenerCotizacionIOL(
        activo: { prefijo: string; nombre: string; tipo: string },
        cotizacionUSD: number
    ): Promise<StockDashboardItem> {
        const mercado = this.resolverMercado(activo.tipo);
        const endpoint = IOL_ENDPOINTS.COTIZACION(mercado, activo.prefijo);

        this.logger.debug(`Consultando IOL: ${endpoint}`);

        const data = await this.iolService['get'](endpoint).toPromise();

        const esARS = data.moneda === 'peso_Argentino';
        const precioLocal = data.ultimoPrecio;
        const precioUSD = esARS && cotizacionUSD > 0
            ? precioLocal / cotizacionUSD
            : precioLocal;

        const convertir = (valor: number) =>
            esARS && cotizacionUSD > 0 ? valor / cotizacionUSD : valor;

        return {
            symbol: activo.prefijo,
            name: data.descripcionTitulo || activo.nombre,
            tipo: activo.tipo as 'Cedear' | 'Accion',
            mercado,
            precioLocal,
            moneda: esARS ? 'ARS' : 'USD',
            precioUSD: Math.round(precioUSD * 100) / 100,
            variacionPorc: data.variacion,
            apertura: convertir(data.apertura),
            maximo: convertir(data.maximo),
            minimo: convertir(data.minimo),
            cierreAnterior: convertir(data.cierreAnterior),
            tendencia: data.tendencia,
            cotizacionUSD: esARS ? cotizacionUSD : 0,
        };
    }

    private resolverMercado(tipo: string): string {
        if (tipo === 'Accion') return IOL_MARKETS.BCBA;
        return IOL_MARKETS.NYSE;
    }

    private mapCryptoTickers(
        symbols: string[],
        tickers: Record<string, any>
    ): CryptoDashboardItem[] {
        return symbols
            .filter(symbol => tickers[symbol] !== undefined)
            .map(symbol => {
                const meta = CRYPTO_METADATA[symbol as keyof typeof CRYPTO_METADATA];
                const ticker = tickers[symbol];
                return {
                    symbol,
                    name: meta?.name ?? symbol,
                    color: meta?.color ?? '#6B7280',
                    price: ticker.price,
                    priceChangePercent: ticker.priceChangePercent,
                    highPrice: ticker.highPrice,
                    lowPrice: ticker.lowPrice,
                    volume: ticker.volume,
                };
            });
    }
}