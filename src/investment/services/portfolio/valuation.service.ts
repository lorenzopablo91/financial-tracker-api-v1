import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BinanceMainService } from 'src/binance-api/core/services/binance-main.service';
import { DolarBaseService } from 'src/dolar-api/core/services/dolar-base/dolar-base.service';
import { ActivoValorizado, ResumenCategoria, TIPO_CONFIG } from 'src/investment/interfaces/valuation.interface';
import { IOL_ENDPOINTS } from 'src/iol-api/core/constants/iol-endpoints';
import { IolBaseService } from 'src/iol-api/core/services/iol-base/iol-base.service';

@Injectable()
export class ValuationService {
    private readonly logger = new Logger(ValuationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly binanceService: BinanceMainService,
        private readonly dolarBaseService: DolarBaseService,
        private readonly iolService: IolBaseService
    ) { }

    // ===== VALORIZACIÓN PORTAFOLIO =====

    async calcularValorPortafolio(portafolioId: string) {
        // 1. Validar y obtener portafolio
        const portafolio = await this.obtenerPortafolio(portafolioId);

        const capitalInicial = Number(portafolio.capitalInicial);
        const gananciasRealizadas = Number(portafolio.gananciasRealizadas);

        // 2. Caso sin activos
        if (portafolio.activos.length === 0) {
            return this.construirRespuestaSinActivos(
                portafolio.nombre,
                capitalInicial,
                gananciasRealizadas
            );
        }

        // 3. Obtener precios de mercado
        const { preciosCrypto, preciosCedears, cotizacionCCL } =
            await this.obtenerPreciosMercado(portafolio.activos);

        // 4. Valorizar activos
        const activosValorizados = this.valorizarActivos(
            portafolio.activos,
            preciosCrypto,
            preciosCedears,
            cotizacionCCL
        );

        // 5. Calcular totales
        const totales = this.calcularTotales(
            activosValorizados,
            capitalInicial,
            gananciasRealizadas
        );

        // 6. Generar resumen por categorías
        const categorias = this.generarResumenCategorias(
            activosValorizados,
            totales
        );

        // 7. Construir respuesta final
        return {
            portafolio: portafolio.nombre,
            ...totales,
            activos: activosValorizados,
            categorias,
            metadata: {
                timestamp: new Date().toISOString(),
                activosCount: activosValorizados.length,
                cotizacionCCL
            }
        };
    }

    // HELPERS PRIVADOS

    private async obtenerPortafolio(portafolioId: string) {
        const portafolio = await this.prisma.portafolio.findUnique({
            where: { id: portafolioId },
            include: { activos: true }
        });

        if (!portafolio) {
            throw new NotFoundException('Portafolio no encontrado');
        }

        return portafolio;
    }

    private async obtenerPreciosCrypto(symbols: string[]): Promise<Record<string, number>> {
        if (symbols.length === 0) return {};

        try {
            const prices = await this.binanceService.getCryptoPrices(symbols).toPromise();

            const result: Record<string, number> = {};
            for (const [key, value] of Object.entries(prices || {})) {
                const symbol = key.replace('USDT', '');
                result[symbol] = value;
            }
            return result;
        } catch (error) {
            this.logger.error('Error obteniendo precios crypto:', error);
            return {};
        }
    }

    private async obtenerPreciosCedearsYAcciones(prefijos: string[]): Promise<Record<string, number>> {
        if (prefijos.length === 0) return {};

        try {
            // Obtener portfolio de IOL (Argentina)
            const portfolioIOL = await this.iolService['get'](IOL_ENDPOINTS.PORTFOLIO_ARG).toPromise();

            if (!portfolioIOL || !Array.isArray(portfolioIOL.activos)) {
                this.logger.warn('Portfolio IOL no contiene activos válidos');
                return {};
            }

            // Crear mapa de precios: prefijo -> ultimoPrecio (en ARS)
            const precios: Record<string, number> = {};

            portfolioIOL.activos.forEach(activo => {
                const simbolo = activo?.titulo?.simbolo;
                const ultimoPrecio = activo?.ultimoPrecio;

                if (simbolo && ultimoPrecio && ultimoPrecio > 0) {
                    precios[simbolo.toUpperCase()] = Number(ultimoPrecio);
                }
            });

            // Filtrar solo los activos que necesitamos
            const resultado: Record<string, number> = {};
            prefijos.forEach(prefijo => {
                if (precios[prefijo]) {
                    resultado[prefijo] = precios[prefijo];
                } else {
                    this.logger.warn(`No se encontró precio para ${prefijo} en IOL`);
                }
            });

            this.logger.log(
                `Precios IOL obtenidos (${Object.keys(resultado).length}/${prefijos.length}): ` +
                Object.keys(resultado).join(', ')
            );

            return resultado;
        } catch (error) {
            this.logger.error('Error obteniendo precios de IOL:', error);
            return {};
        }
    }

    private async obtenerCotizacionCCL(): Promise<number> {
        try {
            const cotizacion = await this.dolarBaseService.getCotizacionPorTipo('ccl').toPromise();
            const valor = cotizacion?.venta || 1200;
            this.logger.log(`Cotización CCL: $${valor}`);
            return valor;
        } catch (error) {
            this.logger.error('Error obteniendo cotización CCL:', error);
            return 1200;
        }
    }

    private async obtenerPreciosMercado(activos: any[]) {
        const cryptos = activos.filter(a => a.tipo === 'Criptomoneda');
        const cedears = activos.filter(a => a.tipo === 'Cedear');
        const acciones = activos.filter(a => a.tipo === 'Accion');

        const [preciosCrypto, preciosCedears, cotizacionCCL] = await Promise.all([
            this.obtenerPreciosCrypto(cryptos.map(c => c.prefijo)),
            this.obtenerPreciosCedearsYAcciones([
                ...cedears.map(c => c.prefijo),
                ...acciones.map(a => a.prefijo)
            ]),
            this.obtenerCotizacionCCL()
        ]);

        return { preciosCrypto, preciosCedears, cotizacionCCL };
    }

    private construirRespuestaSinActivos(
        nombre: string,
        capitalInicial: number,
        gananciasRealizadas: number
    ) {
        const totalInvertido = capitalInicial + gananciasRealizadas;
        const gananciaTotalPorc = capitalInicial > 0
            ? (gananciasRealizadas / capitalInicial) * 100
            : 0;

        return {
            portafolio: nombre,
            capitalInicial,
            gananciasRealizadas,
            valorActualActivos: 0,
            costoBaseActivos: 0,
            gananciasNoRealizadas: 0,
            totalInvertido,
            gananciaTotal: gananciasRealizadas,
            gananciaTotalPorc,
            activos: [],
            categorias: [],
            metadata: {
                timestamp: new Date().toISOString(),
                activosCount: 0,
                cotizacionCCL: 0
            }
        };
    }

    private valorizarActivos(
        activos: any[],
        preciosCrypto: Record<string, number>,
        preciosCedears: Record<string, number>,
        cotizacionCCL: number
    ): ActivoValorizado[] {
        return activos.map(activo => {
            const precioMercado = this.obtenerPrecioMercado(
                activo,
                preciosCrypto,
                preciosCedears,
                cotizacionCCL
            );

            const cantidad = Number(activo.cantidad);
            const costoPromedioUSD = Number(activo.costoPromedioUSD);
            const valorActual = cantidad * precioMercado;
            const costoBase = cantidad * costoPromedioUSD;
            const gananciaPerdida = valorActual - costoBase;
            const gananciaPorc = costoBase > 0
                ? (gananciaPerdida / costoBase) * 100
                : 0;

            return {
                id: activo.id,
                nombre: activo.nombre,
                prefijo: activo.prefijo,
                tipo: activo.tipo,
                cantidad,
                costoPromedioUSD: this.redondear(costoPromedioUSD),
                costoPromedioARS: activo.costoPromedioARS
                    ? this.redondear(Number(activo.costoPromedioARS))
                    : null,
                tipoCambioPromedio: activo.tipoCambioPromedio
                    ? Number(activo.tipoCambioPromedio)
                    : null,
                precioMercado: this.redondear(precioMercado),
                costoBase: this.redondear(costoBase),
                valorActual: this.redondear(valorActual),
                gananciaPerdida: this.redondear(gananciaPerdida),
                gananciaPorc: this.redondear(gananciaPorc)
            };
        });
    }

    private obtenerPrecioMercado(
        activo: any,
        preciosCrypto: Record<string, number>,
        preciosCedears: Record<string, number>,
        cotizacionCCL: number
    ): number {
        if (activo.tipo === 'Criptomoneda') {
            return preciosCrypto[activo.prefijo] || 0;
        }

        if (activo.tipo === 'Cedear' || activo.tipo === 'Accion') {
            const precioARS = preciosCedears[activo.prefijo] || 0;
            return precioARS / cotizacionCCL;
        }

        return 0;
    }

    private calcularTotales(
        activosValorizados: ActivoValorizado[],
        capitalInicial: number,
        gananciasRealizadas: number
    ) {
        const valorActualActivos = activosValorizados.reduce(
            (sum, a) => sum + a.valorActual,
            0
        );
        const costoBaseActivos = activosValorizados.reduce(
            (sum, a) => sum + a.costoBase,
            0
        );
        const gananciasNoRealizadas = valorActualActivos - costoBaseActivos;
        const totalInvertido = capitalInicial + gananciasRealizadas;
        const gananciaTotal = gananciasRealizadas + gananciasNoRealizadas;
        const gananciaTotalPorc = capitalInicial > 0
            ? (gananciaTotal / capitalInicial) * 100
            : 0;

        return {
            capitalInicial: this.redondear(capitalInicial),
            gananciasRealizadas: this.redondear(gananciasRealizadas),
            gananciasNoRealizadas: this.redondear(gananciasNoRealizadas),
            valorActualActivos: this.redondear(valorActualActivos),
            costoBaseActivos: this.redondear(costoBaseActivos),
            totalInvertido: this.redondear(totalInvertido),
            gananciaTotal: this.redondear(gananciaTotal),
            gananciaTotalPorc: this.redondear(gananciaTotalPorc)
        };
    }

    private generarResumenCategorias(
        activosValorizados: ActivoValorizado[],
        totales: any
    ): ResumenCategoria[] {
        const valorActualTotal = totales.valorActualActivos;

        const categorias: ResumenCategoria[] = [
            {
                name: 'TOTAL',
                amount: valorActualTotal,
                color: '',
                percentage: 100,
                percentageGain: Math.round(totales.gananciaTotalPorc),
                amountGain: totales.gananciaTotal,
                icon: '',
                type: 'total'
            }
        ];

        // Agregar resumen por cada tipo
        (['Criptomoneda', 'Cedear', 'Accion'] as const).forEach(tipo => {
            const resumen = this.calcularResumenPorTipo(
                tipo,
                activosValorizados,
                valorActualTotal
            );
            if (resumen.amount > 0) {
                categorias.push(resumen);
            }
        });

        return categorias;
    }

    private calcularResumenPorTipo(
        tipo: keyof typeof TIPO_CONFIG,
        activosValorizados: ActivoValorizado[],
        valorActualTotal: number
    ): ResumenCategoria {
        const config = TIPO_CONFIG[tipo];
        const activosTipo = activosValorizados.filter(a => a.tipo === tipo);

        const valor = activosTipo.reduce((sum, a) => sum + a.valorActual, 0);
        const costo = activosTipo.reduce((sum, a) => sum + a.costoBase, 0);
        const ganancia = valor - costo;
        const percentage = valorActualTotal > 0
            ? this.redondear((valor / valorActualTotal) * 100, 1)
            : 0;
        const percentageGain = costo > 0
            ? this.redondear((ganancia / costo) * 100)
            : 0;

        return {
            name: config.name,
            amount: valor,
            color: config.color,
            percentage,
            percentageGain,
            amountGain: this.redondear(ganancia),
            icon: config.icon,
            type: config.type
        };
    }

    private redondear(valor: number, decimales: number = 2): number {
        const factor = Math.pow(10, decimales);
        return Math.round(valor * factor) / factor;
    }

}