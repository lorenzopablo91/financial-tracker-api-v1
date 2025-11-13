import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Role, Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CapitalService } from 'src/investment/services/portfolio/capital.service';

@Controller('api/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CapitalController {

    constructor(
        private readonly capitalService: CapitalService,
    ) { }

    // ===== OPERACIONES DE CAPITAL =====

    // Agregar capital al portafolio
    @Post(':id/aporte')
    @Roles(Role.ADMIN)
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
    @Roles(Role.ADMIN)
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