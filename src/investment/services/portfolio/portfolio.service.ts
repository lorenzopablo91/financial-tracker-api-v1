import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class PortfolioService {

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

  // Helper para calcular el efectivo disponible (Liquid Cash)
  async obtenerEfectivoDisponible(id: string): Promise<number> {
    const portafolio = await this.prisma.portafolio.findUnique({
      where: { id },
      include: { activos: true }
    });

    if (!portafolio) {
      throw new NotFoundException(`Portafolio ${id} no encontrado`);
    }

    const capitalInicial = Number(portafolio.capitalInicial);
    const gananciasRealizadas = Number(portafolio.gananciasRealizadas);

    // Costo base = sumatoria de (cantidad * costoPromedioUSD)
    const costoBaseActivos = portafolio.activos.reduce(
      (sum, activo) => sum + (Number(activo.cantidad) * Number(activo.costoPromedioUSD)),
      0
    );

    // Formula: Cash = Capital + Gains - Invested
    return capitalInicial + gananciasRealizadas - costoBaseActivos;
  }

}