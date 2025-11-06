import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AssetsService } from 'src/investment/services/portfolio/assets.service';

@Controller('api/portfolio')
export class AssetsController {

    constructor(
        private readonly assetsService: AssetsService
    ) { }

    // ===== OPERACIONES DE ACTIVOS =====

    @Post(':id/compra')
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
    @HttpCode(HttpStatus.NO_CONTENT)
    async eliminarActivo(@Param('activoId') activoId: string) {
        await this.assetsService.eliminarActivo(activoId);
    }
}