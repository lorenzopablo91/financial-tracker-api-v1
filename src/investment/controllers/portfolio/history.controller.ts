import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from 'src/investment/services/portfolio/history.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles, Role } from 'src/auth/decorators/roles.decorator';

@Controller('api/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HistoryController {
    constructor(
        private readonly historyService: HistoryService
    ) { }

    // ===== HISTÓRICO =====

    @Get(':id/operaciones')
    @Roles(Role.ADMIN, Role.VIEWER)
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

    @Get(':id/snapshots')
    @Roles(Role.ADMIN, Role.VIEWER)
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

    @Post(':id/snapshot')
    @Roles(Role.ADMIN)
    async crearSnapshot(
        @Param('id') id: string
    ) {
        const snapshot = await this.historyService.crearSnapshot(id);
        return {
            success: true,
            message: 'Valuación del portafolio guardada correctamente',
            data: snapshot
        };
    }
}