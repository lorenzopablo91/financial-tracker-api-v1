import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Role, Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AssetsService } from 'src/investment/services/portfolio/assets.service';

@Controller('api/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {

    constructor(
        private readonly assetsService: AssetsService
    ) { }

    // ===== OPERACIONES DE ACTIVOS =====

    @Post(':id/compra')
    @Roles(Role.ADMIN)
    async registrarCompra(
        @Param('id') portafolioId: string,
        @Body() body: {
            prefijo: string;
            nombre?: string;
            tipo: 'Criptomoneda' | 'Cedear' | 'Accion';
            cantidad: number;
            precioUSD?: number;
            precioARS?: number;
            tipoCambio?: number;
            notas?: string;
        }
    ) {
        const resultado = await this.assetsService.registrarCompra(portafolioId, body);
        return {
            success: true,
            ...resultado
        };
    }

    @Post('activos/:activoId/venta')
    @Roles(Role.ADMIN)
    async registrarVenta(
        @Param('activoId') activoId: string,
        @Body() body: {
            cantidad: number;
            precioUSD?: number;
            precioARS?: number;
            tipoCambio?: number;
            notas?: string;
        }
    ) {
        const resultado = await this.assetsService.registrarVenta(activoId, body);
        return {
            success: true,
            ...resultado
        };
    }

    @Delete('activos/:activoId')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    async eliminarActivo(@Param('activoId') activoId: string) {
        await this.assetsService.eliminarActivo(activoId);
    }
}