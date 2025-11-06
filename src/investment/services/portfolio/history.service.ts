import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ValuationService } from './valuation.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class HistoryService {

    private readonly logger = new Logger(HistoryService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly valuationService: ValuationService
    ) { }

    // ===== HISTÓRICO =====

    async obtenerHistorialOperaciones(portafolioId: string, limit = 50) {
        return this.prisma.operacion.findMany({
            where: { portafolioId },
            include: {
                activo: {
                    select: {
                        nombre: true,
                        prefijo: true,
                        tipo: true
                    }
                }
            },
            orderBy: { fecha: 'desc' },
            take: limit
        });
    }

    async crearSnapshot(portafolioId: string) {
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

    async obtenerHistoricoSnapshots(portafolioId: string, limit = 30) {
        return this.prisma.portafolioSnapshot.findMany({
            where: { portafolioId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                capitalInicial: true,
                gananciasRealizadas: true,
                valorActual: true,
                gananciasNoRealizadas: true,
                totalInvertido: true,
                gananciaTotal: true,
                gananciaTotalPorc: true,
                createdAt: true
            }
        });
    }

    // Se ejecuta todos los días a las 00:00
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async crearSnapshotsDiarios() {
        this.logger.log('Iniciando creación de snapshots diarios...');

        try {
            // Obtener todos los portafolios activos
            const portafolios = await this.prisma.portafolio.findMany({
                select: { id: true, nombre: true }
            });

            this.logger.log(`Encontrados ${portafolios.length} portafolios`);

            let exitosos = 0;
            let fallidos = 0;

            // Crear snapshot para cada portafolio
            for (const portafolio of portafolios) {
                try {
                    await this.crearSnapshot(portafolio.id);
                    exitosos++;
                    this.logger.log(`Snapshot creado para portafolio: ${portafolio.nombre}`);
                } catch (error) {
                    fallidos++;
                    this.logger.error(
                        `Error al crear snapshot para ${portafolio.nombre}:`,
                        error.message
                    );
                }
            }

            this.logger.log(
                `Snapshots completados: ${exitosos} exitosos, ${fallidos} fallidos`
            );
        } catch (error) {
            this.logger.error('Error en la tarea de snapshots diarios:', error);
        }
    }

}