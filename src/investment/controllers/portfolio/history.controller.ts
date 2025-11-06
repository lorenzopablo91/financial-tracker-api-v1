import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { HistoryService } from 'src/investment/services/portfolio/history.service';

@Controller('api/portfolio')
export class HistoryController {

    constructor(
        private readonly historyService: HistoryService
    ) { }

    // ===== HISTÓRICO =====

    @Get(':id/operaciones')
    async obtenerHistorialOperaciones(
        @Param('id') portafolioId: string,
        @Query('limit') limit?: string
    ) {
        const operaciones = await this.historyService.obtenerHistorialOperaciones(
            portafolioId,
            limit ? parseInt(limit) : 50
        );
        return {
            success: true,
            count: operaciones.length,
            data: operaciones
        };
    }

    @Post(':id/snapshot')
    async crearSnapshot(@Param('id') id: string) {
        const snapshot = await this.historyService.crearSnapshot(id);
        return {
            success: true,
            message: 'Snapshot creado exitosamente',
            data: snapshot
        };
    }

    @Get(':id/snapshots')
    async obtenerSnapshots(
        @Param('id') portafolioId: string,
        @Query('limit') limit?: string
    ) {
        const snapshots = await this.historyService.obtenerHistoricoSnapshots(
            portafolioId,
            limit ? parseInt(limit) : 30
        );
        return {
            success: true,
            count: snapshots.length,
            data: snapshots
        };
    }

}