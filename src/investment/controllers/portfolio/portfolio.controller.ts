import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PortfolioService } from 'src/investment/services/portfolio/portfolio.service';

@Controller('api/portfolio')
export class PortfolioController {

  constructor(
    private readonly portfolioService: PortfolioService
  ) { }

  // ===== CRUD PORTAFOLIOS =====

  // Crear un portafolio
  @Post()
  async crearPortafolio(@Body() body: {
    nombre: string;
    descripcion?: string;
    capitalInicial?: number;
  }) {
    const portafolio = await this.portfolioService.crearPortafolio(body);
    return {
      success: true,
      message: 'Portafolio creado exitosamente',
      data: portafolio
    };
  }

  // Obtener todos los portafolios
  @Get()
  async obtenerPortafolios() {
    const portafolios = await this.portfolioService.obtenerPortafolios();
    return {
      success: true,
      count: portafolios.length,
      data: portafolios
    };
  }

  // Obtener un portafolio por ID
  @Get(':id')
  async obtenerPortafolio(@Param('id') id: string) {
    const portafolio = await this.portfolioService.obtenerPortafolio(id);
    return {
      success: true,
      data: portafolio
    };
  }

  // Eliminar un portafolio por ID
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarPortafolio(@Param('id') id: string) {
    await this.portfolioService.eliminarPortafolio(id);
  }

}