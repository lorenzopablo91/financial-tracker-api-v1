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
        const { preciosCrypto, preciosIOL, cotizacionUSD } =
            await this.obtenerPreciosMercado(portafolio.activos);

        // 4. Valorizar activos
        const activosValorizados = this.valorizarActivos(
            portafolio.activos,
            preciosCrypto,
            preciosIOL,
            cotizacionUSD
        );

        // 5. Calcular totales
        const totales = this.calcularTotales(
            activosValorizados,
            capitalInicial,
            gananciasRealizadas
        );

        // 6. Calcular porcentaje de composición para cada activo
        const activosConPorcentaje = this.calcularPorcentajesComposicion(
            activosValorizados,
            totales.valorActualActivos
        );

        // 7. Generar resumen por categorías
        const categorias = this.generarResumenCategorias(
            activosConPorcentaje,
            totales
        );

        // 8. Construir respuesta final
        return {
            portafolio: portafolio.nombre,
            ...totales,
            activos: activosConPorcentaje,
            categorias,
            metadata: {
                timestamp: new Date().toISOString(),
                activosCount: activosConPorcentaje.length,
                cotizacionUSD
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
            this.logger.log(`📡 Obteniendo precios crypto: ${symbols.join(', ')}`);
            const prices = await this.binanceService.getCryptoPrices(symbols).toPromise();

            this.logger.log(`✅ Precios recibidos: ${Object.keys(prices || {}).length}/${symbols.length}`);

            const result: Record<string, number> = {};
            for (const [key, value] of Object.entries(prices || {})) {
                result[key] = value;
            }

            return result;
        } catch (error: any) {
            this.logger.error('Error obteniendo precios crypto:', error.message);
            return {};
        }
    }

    private async obtenerPreciosIOL(prefijos: string[]): Promise<Record<string, number>> {
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
                let precio = activo?.ultimoPrecio;

                if (simbolo && precio && precio > 0) {
                    precios[simbolo.toUpperCase()] = Number(precio);
                    this.logger.debug(`${simbolo}: $${precio} ARS`);
                }
            });

            // Filtrar solo los activos que necesitamos
            const resultado: Record<string, number> = {};
            prefijos.forEach(prefijo => {
                const prefijoUpper = prefijo.toUpperCase();
                if (precios[prefijoUpper]) {
                    resultado[prefijo] = precios[prefijoUpper];
                } else {
                    this.logger.warn(`❌ No se encontró precio para ${prefijo} en IOL`);
                }
            });

            this.logger.log(
                `✅ Precios IOL obtenidos (${Object.keys(resultado).length}/${prefijos.length}): ` +
                Object.keys(resultado).join(', ')
            );

            return resultado;
        } catch (error) {
            this.logger.error('Error obteniendo precios de IOL:', error);
            return {};
        }
    }

    private async obtenerCotizacionUSD(): Promise<number> {
        try {
            const cotizacion = await this.dolarBaseService.getCotizacionPorTipo('mep').toPromise();
            const valor = cotizacion?.venta || 0;
            this.logger.log(`Cotización USD: $${valor}`);
            return valor;
        } catch (error) {
            this.logger.error('Error obteniendo cotización USD:', error);
            return 0;
        }
    }

    private async obtenerPreciosMercado(activos: any[]) {
        const cryptos = activos.filter(a => a.tipo === 'Criptomoneda');
        const cedears = activos.filter(a => a.tipo === 'Cedear');
        const acciones = activos.filter(a => a.tipo === 'Accion');
        const fcis = activos.filter(a => a.tipo === 'FCI');

        const [preciosCrypto, preciosIOL, cotizacionUSD] = await Promise.all([
            this.obtenerPreciosCrypto(cryptos.map(c => c.prefijo)),
            this.obtenerPreciosIOL([
                ...cedears.map(c => c.prefijo),
                ...acciones.map(a => a.prefijo),
                ...fcis.map(f => f.prefijo)
            ]),
            this.obtenerCotizacionUSD()
        ]);

        return { preciosCrypto, preciosIOL, cotizacionUSD };
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
                cotizacionUSD: 0
            }
        };
    }

    private valorizarActivos(
        activos: any[],
        preciosCrypto: Record<string, number>,
        preciosIOL: Record<string, number>,
        cotizacionUSD: number
    ): ActivoValorizado[] {
        return activos.map(activo => {
            const precioMercado = this.obtenerPrecioMercado(
                activo,
                preciosCrypto,
                preciosIOL,
                cotizacionUSD
            );

            const cantidad = Number(activo.cantidad);
            const costoPromedioUSD = Number(activo.costoPromedioUSD);
            const valorActual = cantidad * precioMercado;
            const costoBase = cantidad * costoPromedioUSD;
            const gananciaPerdida = valorActual - costoBase;
            const gananciaPorc = costoBase > 0
                ? (gananciaPerdida / costoBase) * 100
                : 0;

            // Obtener configuración del tipo de activo (color e icono)
            const config = TIPO_CONFIG[activo.tipo as keyof typeof TIPO_CONFIG];
            const color = config?.color || '#6B7280'; // Color por defecto
            const icono = config?.icon || 'help_outline'; // Icono por defecto

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
                gananciaPorc: this.redondear(gananciaPorc),
                color: color,
                icono: icono,
                porcentajeComposicion: 0 // Se calculará después
            };
        });
    }

    private calcularPorcentajesComposicion(
        activos: ActivoValorizado[],
        valorActualTotal: number
    ): ActivoValorizado[] {
        if (valorActualTotal === 0) {
            // Si el valor total es 0, todos los activos tienen 0% de composición
            return activos.map(activo => ({
                ...activo,
                porcentajeComposicion: 0
            }));
        }

        return activos.map(activo => ({
            ...activo,
            porcentajeComposicion: this.redondear(
                (activo.valorActual / valorActualTotal) * 100
            )
        }));
    }

    private obtenerPrecioMercado(
        activo: any,
        preciosCrypto: Record<string, number>,
        preciosIOL: Record<string, number>,
        cotizacionUSD: number
    ): number {
        if (activo.tipo === 'Criptomoneda') {
            const precio = preciosCrypto[activo.prefijo] || 0;
            if (precio === 0) {
                this.logger.warn(`⚠️  Precio crypto no encontrado para ${activo.prefijo}`);
            }
            return precio;
        }

        if (activo.tipo === 'FCI') {
            const valorCuotaparteUSD = preciosIOL[activo.prefijo] || 0;
            if (valorCuotaparteUSD === 0) {
                this.logger.warn(`⚠️  Valor cuotaparte no encontrado para ${activo.prefijo} (FCI)`);
                return 0;
            }
            this.logger.debug(`${activo.prefijo} (FCI): Valor cuotaparte $${valorCuotaparteUSD} USD`);
            return valorCuotaparteUSD;
        }

        if (activo.tipo === 'Cedear' || activo.tipo === 'Accion') {
            const precioARS = preciosIOL[activo.prefijo] || 0;
            if (precioARS === 0) {
                this.logger.warn(`⚠️  Precio IOL no encontrado para ${activo.prefijo} (${activo.tipo})`);
                return 0;
            }
            const precioUSD = precioARS / cotizacionUSD;
            this.logger.debug(`${activo.prefijo}: $${precioARS} ARS = $${precioUSD.toFixed(2)} USD (USD: $${cotizacionUSD})`);
            return precioUSD;
        }

        this.logger.warn(`⚠️  Tipo de activo desconocido: ${activo.tipo}`);
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
        const gananciaTotal = gananciasRealizadas + gananciasNoRealizadas;
        const totalInvertido = valorActualActivos + gananciasRealizadas;
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
        (['Criptomoneda', 'Cedear', 'Accion', 'FCI'] as const).forEach(tipo => {
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