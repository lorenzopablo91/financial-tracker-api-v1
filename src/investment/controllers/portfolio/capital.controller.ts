import { Body, Controller, Param, Post } from '@nestjs/common';
import { CapitalService } from 'src/investment/services/portfolio/capital.service';

@Controller('api/portfolio')
export class CapitalController {

    constructor(
        private readonly capitalService: CapitalService,
    ) { }

    // ===== OPERACIONES DE CAPITAL =====

    // Agregar capital al portafolio
    @Post(':id/aporte')
    async registrarAporte(
        @Param('id') portafolioId: string,
        @Body() body: {
            montoUSD: number;
            notas?: string;
        }
    ) {
        const resultado = await this.capitalService.registrarAporte(portafolioId, body);
        return {
            success: true,
            ...resultado
        };
    }

    // Retirar capital del portafolio
    @Post(':id/retiro')
    async registrarRetiro(
        @Param('id') portafolioId: string,
        @Body() body: {
            montoUSD: number;
            notas?: string;
        }
    ) {
        const resultado = await this.capitalService.registrarRetiro(portafolioId, body);
        return {
            success: true,
            ...resultado
        };
    }

}