import { Controller, Get, Param } from '@nestjs/common';
import { ValuationService } from 'src/investment/services/portfolio/valuation.service';

@Controller('api/portfolio')
export class ValuationController {

    constructor(
        private readonly valuationService: ValuationService
    ) { }

    // ===== VALORIZACIÓN COMPLETA =====

    // Calcular valor actual del portafolio
    @Get(':id/valorizar')
    async calcularValorPortafolio(@Param('id') id: string) {
        const valoracion = await this.valuationService.calcularValorPortafolio(id);
        return {
            success: true,
            data: valoracion
        };
    }

}