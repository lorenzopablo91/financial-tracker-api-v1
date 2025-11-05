import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AbmService } from 'src/investment/services/portfolio/abm.service';

@Controller('api/portfolio')
export class AbmController {

  constructor(
    private readonly abmService: AbmService
  ) { }

  // ===== CRUD PORTAFOLIOS =====

  // Crear un portafolio
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

  // Obtener todos los portafolios
  @Get()
  async obtenerPortafolios() {
    const portafolios = await this.abmService.obtenerPortafolios();
    return {
      success: true,
      count: portafolios.length,
      data: portafolios
    };
  }

  // Obtener un portafolio por ID
  @Get(':id')
  async obtenerPortafolio(@Param('id') id: string) {
    const portafolio = await this.abmService.obtenerPortafolio(id);
    return {
      success: true,
      data: portafolio
    };
  }

  // Eliminar un portafolio por ID
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminarPortafolio(@Param('id') id: string) {
    await this.abmService.eliminarPortafolio(id);
  }

}