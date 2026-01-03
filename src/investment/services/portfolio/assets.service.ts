import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PortfolioService } from './portfolio.service';

@Injectable()
export class AssetsService {

    private readonly logger = new Logger(AssetsService.name);

    constructor(
        private readonly portfolioService: PortfolioService,
        private readonly prisma: PrismaService
    ) { }

    // ===== OPERACIONES DE ACTIVOS =====

    async registrarCompra(
        portafolioId: string,
        data: {
            prefijo: string;
            nombre?: string;
            tipo: 'Criptomoneda' | 'Cedear' | 'Accion';
            cantidad: number;
            precioUSD?: number;
            precioARS?: number;
            tipoCambio?: number;
            notas?: string;
            fecha?: Date;
        }
    ) {
        await this.portfolioService.obtenerPortafolio(portafolioId);

        const prefijoUpper = data.prefijo.toUpperCase();
        let precioUSD: number;
        let precioARS: number | null = null;
        let tipoCambio: number | null = null;

        // Determinar precio en USD según el tipo de activo
        if (data.tipo === 'Criptomoneda') {
            if (!data.precioUSD) {
                throw new BadRequestException('Para criptomonedas debes especificar precioUSD');
            }
            precioUSD = data.precioUSD;
        } else {
            if (data.precioARS && data.tipoCambio) {
                precioARS = data.precioARS;
                tipoCambio = data.tipoCambio;
                precioUSD = precioARS / tipoCambio;
                this.logger.log(
                    `${prefijoUpper}: Precio ARS ${precioARS} / TC ${tipoCambio} = USD ${precioUSD.toFixed(2)}`
                );
            } else if (data.precioUSD) {
                precioUSD = data.precioUSD;
            } else {
                throw new BadRequestException(
                    'Para Cedears/Acciones debes especificar: (precioARS + tipoCambio) o precioUSD'
                );
            }
        }

        const montoTotal = data.cantidad * precioUSD;

        let activo = await this.prisma.activo.findUnique({
            where: {
                portafolioId_prefijo: {
                    portafolioId,
                    prefijo: prefijoUpper
                }
            }
        });

        if (activo) {
            const cantidadAnterior = Number(activo.cantidad);
            const costoBaseAnteriorUSD = cantidadAnterior * Number(activo.costoPromedioUSD);

            const nuevaCantidad = cantidadAnterior + data.cantidad;
            const nuevoCostoBaseUSD = costoBaseAnteriorUSD + montoTotal;
            const nuevoCostoPromedioUSD = nuevoCostoBaseUSD / nuevaCantidad;

            let nuevoCostoPromedioARS: number | null = null;
            let nuevoTipoCambioPromedio: number | null = null;

            if (precioARS && tipoCambio && activo.costoPromedioARS && activo.tipoCambioPromedio) {
                const costoBaseAnteriorARS = cantidadAnterior * Number(activo.costoPromedioARS);
                const nuevoCostoBaseARS = costoBaseAnteriorARS + (data.cantidad * precioARS);
                nuevoCostoPromedioARS = nuevoCostoBaseARS / nuevaCantidad;

                const sumaTCAnterior = cantidadAnterior * Number(activo.tipoCambioPromedio);
                const sumaTCNueva = data.cantidad * tipoCambio;
                nuevoTipoCambioPromedio = (sumaTCAnterior + sumaTCNueva) / nuevaCantidad;
            } else if (precioARS && tipoCambio) {
                nuevoCostoPromedioARS = precioARS;
                nuevoTipoCambioPromedio = tipoCambio;
            }

            activo = await this.prisma.activo.update({
                where: { id: activo.id },
                data: {
                    cantidad: nuevaCantidad,
                    costoPromedioUSD: nuevoCostoPromedioUSD,
                    ...(nuevoCostoPromedioARS && { costoPromedioARS: nuevoCostoPromedioARS }),
                    ...(nuevoTipoCambioPromedio && { tipoCambioPromedio: nuevoTipoCambioPromedio })
                }
            });

            this.logger.log(
                `${prefijoUpper} actualizado: ` +
                `cantidad ${cantidadAnterior} → ${nuevaCantidad}, ` +
                `costo promedio USD ${Number(activo.costoPromedioUSD).toFixed(2)} → ${nuevoCostoPromedioUSD.toFixed(2)}`
            );
        } else {
            activo = await this.prisma.activo.create({
                data: {
                    portafolioId,
                    nombre: data.nombre || prefijoUpper,
                    prefijo: prefijoUpper,
                    cantidad: data.cantidad,
                    costoPromedioUSD: precioUSD,
                    ...(precioARS && { costoPromedioARS: precioARS }),
                    ...(tipoCambio && { tipoCambioPromedio: tipoCambio }),
                    tipo: data.tipo
                }
            });

            this.logger.log(`Nuevo activo creado: ${prefijoUpper}`);
        }

        const operacion = await this.prisma.operacion.create({
            data: {
                portafolioId,
                activoId: activo.id,
                tipo: 'COMPRA',
                cantidad: data.cantidad,
                precioUSD: precioUSD,
                ...(precioARS && { precioARS }),
                ...(tipoCambio && { tipoCambio }),
                montoUSD: montoTotal,
                activoPrefijo: data.prefijo,
                activoNombre: data.nombre || activo.nombre,
                activoTipo: data.tipo,
                notas: data.notas,
                fecha: data.fecha || new Date()
            }
        });

        return {
            operacion,
            mensaje: `Compra de ${data.cantidad} ${prefijoUpper} registrada exitosamente`
        };
    }

    async registrarVenta(
        activoId: string,
        data: {
            cantidad: number;
            precioUSD?: number;
            precioARS?: number;
            tipoCambio?: number;
            notas?: string;
            fecha?: Date;
        }
    ) {
        const activo = await this.prisma.activo.findUnique({
            where: { id: activoId },
            include: { portafolio: true }
        });

        if (!activo) {
            throw new NotFoundException('Activo no encontrado');
        }

        const cantidadActual = Number(activo.cantidad);

        if (data.cantidad > cantidadActual) {
            throw new BadRequestException(
                `No puedes vender ${data.cantidad} ${activo.prefijo}. Solo tienes ${cantidadActual}`
            );
        }

        // Determinar precio en USD según el tipo de activo
        let precioUSD: number;
        let precioARS: number | null = null;
        let tipoCambio: number | null = null;

        if (activo.tipo === 'Criptomoneda') {
            // Crypto: siempre en USD
            if (!data.precioUSD) {
                throw new BadRequestException('Para criptomonedas debes especificar precioUSD');
            }
            precioUSD = data.precioUSD;
        } else {
            // Cedears/Acciones: pueden estar en ARS o USD
            if (data.precioARS && data.tipoCambio) {
                // Precio en ARS: convertir a USD
                precioARS = data.precioARS;
                tipoCambio = data.tipoCambio;
                precioUSD = precioARS / tipoCambio;
                this.logger.log(
                    `${activo.prefijo} VENTA: Precio ARS ${precioARS} / TC ${tipoCambio} = USD ${precioUSD.toFixed(2)}`
                );
            } else if (data.precioUSD) {
                // Precio directo en USD
                precioUSD = data.precioUSD;
            } else {
                throw new BadRequestException(
                    'Para Cedears/Acciones debes especificar: (precioARS + tipoCambio) o precioUSD'
                );
            }
        }

        const montoVenta = data.cantidad * precioUSD;
        const costoBaseVendido = data.cantidad * Number(activo.costoPromedioUSD);
        const gananciaRealizada = montoVenta - costoBaseVendido;

        // Registrar operación
        const operacion = await this.prisma.operacion.create({
            data: {
                portafolioId: activo.portafolioId,
                activoId: activo.id,
                tipo: 'VENTA',
                cantidad: data.cantidad,
                precioUSD: precioUSD,
                ...(precioARS && { precioARS }),
                ...(tipoCambio && { tipoCambio }),
                montoUSD: montoVenta,
                costoBaseVendido,
                gananciaRealizada,
                notas: data.notas,
                activoPrefijo: activo.prefijo,
                activoNombre: activo.nombre,
                activoTipo: activo.tipo,
                fecha: data.fecha || new Date()
            }
        });

        // Actualizar ganancias realizadas del portfolio
        await this.prisma.portafolio.update({
            where: { id: activo.portafolioId },
            data: {
                gananciasRealizadas: {
                    increment: gananciaRealizada
                }
            }
        });

        // Actualizar o eliminar el activo
        const nuevaCantidad = cantidadActual - data.cantidad;

        if (nuevaCantidad > 0.00000001) {
            await this.prisma.activo.update({
                where: { id: activoId },
                data: { cantidad: nuevaCantidad }
            });
            this.logger.log(`${activo.prefijo}: cantidad ${cantidadActual} → ${nuevaCantidad}`);
        } else {
            await this.prisma.activo.delete({
                where: { id: activoId }
            });
            this.logger.log(`${activo.prefijo}: vendido completamente y eliminado`);
        }

        const gananciaPorc = costoBaseVendido > 0
            ? (gananciaRealizada / costoBaseVendido) * 100
            : 0;

        // Calcular también ganancia en ARS si la venta fue en ARS
        const resultadoBase = {
            prefijo: activo.prefijo,
            cantidadVendida: data.cantidad,
            precioVentaUSD: precioUSD,
            ...(precioARS && { precioVentaARS: precioARS }),
            ...(tipoCambio && { tipoCambio }),
            montoVentaUSD: Math.round(montoVenta * 100) / 100,
            ...(precioARS && { montoVentaARS: Math.round((data.cantidad * precioARS) * 100) / 100 }),
            costoBaseVendido: Math.round(costoBaseVendido * 100) / 100,
            gananciaRealizadaUSD: Math.round(gananciaRealizada * 100) / 100,
            gananciaPorc: Math.round(gananciaPorc * 100) / 100
        };

        return {
            operacion,
            resultado: resultadoBase,
            mensaje: `Venta de ${data.cantidad} ${activo.prefijo} registrada. ` +
                `Ganancia: $${Math.round(gananciaRealizada * 100) / 100} USD (${Math.round(gananciaPorc * 100) / 100}%)` +
                (precioARS ? ` - Precio ARS: $${precioARS} (TC: ${tipoCambio})` : '')
        };
    }

    async eliminarActivo(activoId: string) {
        return this.prisma.activo.delete({
            where: { id: activoId }
        });
    }
}