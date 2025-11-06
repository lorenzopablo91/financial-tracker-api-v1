import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ValuationService } from './valuation.service';

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


}