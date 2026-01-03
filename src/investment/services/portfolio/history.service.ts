import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ValuationService } from './valuation.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TIPO_CONFIG } from 'src/investment/interfaces/valuation.interface';

@Injectable()
export class HistoryService {

    private readonly logger = new Logger(HistoryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly valuationService: ValuationService
    ) { }

    // ===== HISTÓRICO =====
    async obtenerHistorialOperaciones(portafolioId: string) {
        const operaciones = await this.prisma.operacion.findMany({
            where: { portafolioId },
            orderBy: { fecha: 'desc' }
        });

        return operaciones.map(op => {
            const tipoConfig = TIPO_CONFIG[op.activoTipo as keyof typeof TIPO_CONFIG];

            return {
                ...op,
                activoIcono: tipoConfig?.icon,
                activoColor: tipoConfig?.color,
            };
        });
    }

    async crearSnapshot(portafolioId: string) {
        // Validar que no exista un snapshot hoy
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);

        const snapshotExistente = await this.prisma.portafolioSnapshot.findFirst({
            where: {
                portafolioId,
                createdAt: {
                    gte: hoy,
                    lt: mañana
                }
            }
        });

        if (snapshotExistente) {
            throw new ConflictException(
                'Ya existe un snapshot para hoy. Solo se permite crear un snapshot por día.'
            );
        }

        // Continuar con la creación del snapshot
        const valoracion = await this.valuationService.calcularValorPortafolio(portafolioId);

        return this.prisma.portafolioSnapshot.create({
            data: {
                portafolioId,
                capitalInicial: valoracion.capitalInicial,
                gananciasRealizadas: valoracion.gananciasRealizadas,
                valorActual: valoracion.valorActualActivos,
                gananciasNoRealizadas: valoracion.gananciasNoRealizadas,
                totalInvertido: valoracion.totalInvertido,
                gananciaTotal: valoracion.gananciaTotal,
                gananciaTotalPorc: valoracion.gananciaTotalPorc,
                snapshot: valoracion as any
            }
        });
    }

    async obtenerHistoricoSnapshots(portafolioId: string) {
        const snapshots = await this.prisma.portafolioSnapshot.findMany({
            where: { portafolioId },
            orderBy: { createdAt: 'asc' },
            select: {
                totalInvertido: true,
                createdAt: true
            }
        });

        return snapshots.map(snapshot => ({
            totalPortfolio: Number(snapshot.totalInvertido),
            date: snapshot.createdAt
        }));
    }

    // TODO: Para implementar este servicio hay que pagar el plan Started de Render
    // Se ejecuta todos los días a las 00:00
    // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    // async crearSnapshotsDiarios() {
    //     this.logger.log('Iniciando creación de snapshots diarios...');

    //     try {
    //         // Obtener todos los portafolios activos
    //         const portafolios = await this.prisma.portafolio.findMany({
    //             select: { id: true, nombre: true }
    //         });

    //         this.logger.log(`Encontrados ${portafolios.length} portafolios`);

    //         let exitosos = 0;
    //         let fallidos = 0;

    //         // Crear snapshot para cada portafolio
    //         for (const portafolio of portafolios) {
    //             try {
    //                 await this.crearSnapshot(portafolio.id);
    //                 exitosos++;
    //                 this.logger.log(`Snapshot creado para portafolio: ${portafolio.nombre}`);
    //             } catch (error) {
    //                 fallidos++;
    //                 this.logger.error(
    //                     `Error al crear snapshot para ${portafolio.nombre}:`,
    //                     error.message
    //                 );
    //             }
    //         }

    //         this.logger.log(
    //             `Snapshots completados: ${exitosos} exitosos, ${fallidos} fallidos`
    //         );
    //     } catch (error) {
    //         this.logger.error('Error en la tarea de snapshots diarios:', error);
    //     }
    // }

}