import { Controller, Get, Param } from '@nestjs/common';
import { ValuacionService } from 'src/investment/services/portfolio/valuacion.service';

@Controller('api/portfolio')
export class ValuacionController {

    constructor(
        private readonly valuacionService: ValuacionService
    ) { }

    // ===== VALORIZACIÓN COMPLETA =====

    // Calcular valor actual del portafolio
    @Get(':id/valorizar')
    async calcularValorPortafolio(@Param('id') id: string) {
        const valoracion = await this.valuacionService.calcularValorPortafolio(id);
        return {
            success: true,
            data: valoracion
        };
    }

}