import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BinanceMainService } from 'src/binance-api/core/services/binance-main.service';
import { DolarBaseService } from 'src/dolar-api/core/services/dolar-base/dolar-base.service';
import { IOL_ENDPOINTS } from 'src/iol-api/core/constants/iol-endpoints';
import { IolBaseService } from 'src/iol-api/core/services/iol-base/iol-base.service';

@Injectable()
export class ValuacionService {
    private readonly logger = new Logger(ValuacionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly binanceService: BinanceMainService,
        private readonly dolarBaseService: DolarBaseService,
        private readonly iolService: IolBaseService
    ) { }

    // ===== VALORIZACIÓN COMPLETA =====

    async calcularValorPortafolio(portafolioId: string) {
        const portafolio = await this.prisma.portafolio.findUnique({
            where: { id: portafolioId },
            include: { activos: true }
        });

        if (!portafolio) {
            throw new NotFoundException('Portafolio no encontrado');
        }

        const capitalInicial = Number(portafolio.capitalInicial);
        const gananciasRealizadas = Number(portafolio.gananciasRealizadas);

        if (portafolio.activos.length === 0) {
            return {
                portafolio: portafolio.nombre,
                capitalInicial,
                gananciasRealizadas,
                valorActualActivos: 0,
                costoBaseActivos: 0,
                gananciasNoRealizadas: 0,
                totalInvertido: capitalInicial + gananciasRealizadas,
                gananciaTotal: gananciasRealizadas,
                gananciaTotalPorc: capitalInicial > 0 ? (gananciasRealizadas / capitalInicial) * 100 : 0,
                activos: [],
                resumenPorTipo: {
                    cryptomonedas: { valorActual: 0, costoBase: 0, gananciaPerdida: 0, gananciaPorc: 0, porcentaje: 0 },
                    cedears: { valorActual: 0, costoBase: 0, gananciaPerdida: 0, gananciaPorc: 0, porcentaje: 0 },
                    acciones: { valorActual: 0, costoBase: 0, gananciaPerdida: 0, gananciaPorc: 0, porcentaje: 0 }
                }
            };
        }

        // Obtener precios de mercado
        const cryptos = portafolio.activos.filter(a => a.tipo === 'Criptomoneda');
        const cedears = portafolio.activos.filter(a => a.tipo === 'Cedear');
        const acciones = portafolio.activos.filter(a => a.tipo === 'Accion');

        const [preciosCrypto, preciosCedears, cotizacionCCL] = await Promise.all([

            this.obtenerPreciosCrypto(cryptos.map(c => c.prefijo)),
            this.obtenerPreciosCedearsYAcciones(
                [...cedears.map(c => c.prefijo), ...acciones.map(a => a.prefijo)]
            ),
            this.obtenerCotizacionCCL()
        ]);

        // Valorizar cada activo
        const activosValorizados = portafolio.activos.map(activo => {
            let precioMercado = 0;

            if (activo.tipo === 'Criptomoneda') {
                precioMercado = preciosCrypto[activo.prefijo] || 0;
            } else if (activo.tipo === 'Cedear' || activo.tipo === 'Accion') {
                const precioARS = preciosCedears[activo.prefijo] || 0;
                precioMercado = precioARS / cotizacionCCL;
            }

            const cantidad = Number(activo.cantidad);
            const costoPromedioUSD = Number(activo.costoPromedioUSD);

            const valorActual = cantidad * precioMercado;
            const costoBase = cantidad * costoPromedioUSD;
            const gananciaPerdida = valorActual - costoBase;
            const gananciaPorc = costoBase > 0 ? (gananciaPerdida / costoBase) * 100 : 0;

            return {
                id: activo.id,
                nombre: activo.nombre,
                prefijo: activo.prefijo,
                tipo: activo.tipo,
                cantidad,
                costoPromedioUSD: Math.round(costoPromedioUSD * 100) / 100,
                costoPromedioARS: activo.costoPromedioARS ? Math.round(Number(activo.costoPromedioARS) * 100) / 100 : null,
                tipoCambioPromedio: activo.tipoCambioPromedio ? Number(activo.tipoCambioPromedio) : null,
                precioMercado: Math.round(precioMercado * 100) / 100,
                costoBase: Math.round(costoBase * 100) / 100,
                valorActual: Math.round(valorActual * 100) / 100,
                gananciaPerdida: Math.round(gananciaPerdida * 100) / 100,
                gananciaPorc: Math.round(gananciaPorc * 100) / 100
            };
        });

        const valorActualActivos = activosValorizados.reduce((sum, a) => sum + a.valorActual, 0);
        const costoBaseActivos = activosValorizados.reduce((sum, a) => sum + a.costoBase, 0);
        const gananciasNoRealizadas = valorActualActivos - costoBaseActivos;

        // Resumen por tipo
        const calcularResumenTipo = (tipo: string) => {
            const activosTipo = activosValorizados.filter(a => a.tipo === tipo);
            const valor = activosTipo.reduce((sum, a) => sum + a.valorActual, 0);
            const costo = activosTipo.reduce((sum, a) => sum + a.costoBase, 0);
            const ganancia = valor - costo;

            return {
                valorActual: Math.round(valor * 100) / 100,
                costoBase: Math.round(costo * 100) / 100,
                gananciaPerdida: Math.round(ganancia * 100) / 100,
                gananciaPorc: costo > 0 ? Math.round((ganancia / costo) * 100 * 100) / 100 : 0,
                porcentaje: valorActualActivos > 0
                    ? Math.round((valor / valorActualActivos) * 100 * 10) / 10
                    : 0
            };
        };

        // Cálculos finales
        const totalInvertido = capitalInicial + gananciasRealizadas;
        const gananciaTotal = gananciasRealizadas + gananciasNoRealizadas;
        const gananciaTotalPorc = capitalInicial > 0
            ? (gananciaTotal / capitalInicial) * 100
            : 0;

        return {
            portafolio: portafolio.nombre,

            // Capital y ganancias
            capitalInicial: Math.round(capitalInicial * 100) / 100,
            gananciasRealizadas: Math.round(gananciasRealizadas * 100) / 100,
            gananciasNoRealizadas: Math.round(gananciasNoRealizadas * 100) / 100,

            // Valores actuales
            valorActualActivos: Math.round(valorActualActivos * 100) / 100,
            costoBaseActivos: Math.round(costoBaseActivos * 100) / 100,

            // Totales
            totalInvertido: Math.round(totalInvertido * 100) / 100,
            gananciaTotal: Math.round(gananciaTotal * 100) / 100,
            gananciaTotalPorc: Math.round(gananciaTotalPorc * 100) / 100,

            activos: activosValorizados,

            resumenPorTipo: {
                cryptomonedas: calcularResumenTipo('Criptomoneda'),
                cedears: calcularResumenTipo('Cedear'),
                acciones: calcularResumenTipo('Accion')
            },

            metadata: {
                timestamp: new Date().toISOString(),
                activosCount: activosValorizados.length,
                cotizacionCCL
            }
        };
    }

    // ===== HELPERS PRIVADOS =====

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

}