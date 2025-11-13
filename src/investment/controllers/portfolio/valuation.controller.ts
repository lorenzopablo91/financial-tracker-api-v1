import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role, Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { ValuationService } from 'src/investment/services/portfolio/valuation.service';

@Controller('api/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ValuationController {

    constructor(
        private readonly valuationService: ValuationService
    ) { }

    // ===== VALORIZACIÓN COMPLETA =====

    // Calcular valor actual del portafolio
    @Get(':id/valorizar')
    @Roles(Role.ADMIN, Role.VIEWER)
    async calcularValorPortafolio(@Param('id') id: string) {
        const valoracion = await this.valuationService.calcularValorPortafolio(id);
        return {
            success: true,
            data: valoracion
        };
    }

}