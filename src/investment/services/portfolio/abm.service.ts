import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AbmService {

  constructor(
    private readonly prisma: PrismaService
  ) { }

  // ===== ABM PORTAFOLIOS =====

  async crearPortafolio(data: {
    nombre: string;
    descripcion?: string;
    capitalInicial?: number
  }) {
    return this.prisma.portafolio.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        capitalInicial: data.capitalInicial || 0
      },
      include: { activos: true }
    });
  }

  async obtenerPortafolios() {
    return this.prisma.portafolio.findMany({
      include: {
        activos: true,
        _count: {
          select: {
            operaciones: true,
            snapshots: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async obtenerPortafolio(id: string) {
    const portafolio = await this.prisma.portafolio.findUnique({
      where: { id },
      include: {
        activos: true,
        _count: {
          select: {
            operaciones: true,
            snapshots: true
          }
        }
      }
    });

    if (!portafolio) {
      throw new NotFoundException(`Portafolio ${id} no encontrado`);
    }

    return portafolio;
  }

  async eliminarPortafolio(id: string) {
    return this.prisma.portafolio.delete({
      where: { id }
    });
  }

  async eliminarActivo(activoId: string) {
    return this.prisma.activo.delete({
      where: { id: activoId }
    });
  }

}