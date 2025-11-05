import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AbmService } from 'src/investment/services/portfolio/abm.service';

@Controller('api/portfolio')
export class AbmController {

  constructor(
    private readonly abmService: AbmService
  ) { }

  // ===== CRUD PORTAFOLIOS =====

  @Post()
  async crearPortafolio(@Body() body: {
    nombre: string;
    descripcion?: string;
    capitalInicial?: number;
  }) {
    const portafolio = await this.abmService.crearPortafolio(body);
    return {
      success: true,
      message: 'Portafolio creado exitosamente',
      data: portafolio
    };
  }

  @Get()
  async obtenerPortafolios() {
    const portafolios = await this.abmService.obtenerPortafolios();
    return {
      success: true,
      count: portafolios.length,
      data: portafolios
    };
  }

  @Get(':id')
  async obtenerPortafolio(@Param('id') id: string) {
    const portafolio = await this.abmService.obtenerPortafolio(id);
    return {
      success: true,
      data: portafolio
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarPortafolio(@Param('id') id: string) {
    await this.abmService.eliminarPortafolio(id);
  }

}