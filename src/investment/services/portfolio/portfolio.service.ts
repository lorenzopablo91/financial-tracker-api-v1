import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IOL_ENDPOINTS } from '../../../iol-api/core/constants/iol-endpoints';
import { IolBaseService } from '../../../iol-api/core/services/iol-base/iol-base.service';
import { DolarBaseService } from '../../../dolar-api/core/services/dolar-base/dolar-base.service';
import { BinanceMainService } from '../../../binance-api/core/services/binance-main.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly dolarBaseService: DolarBaseService,
    private readonly iolService: IolBaseService,
    private readonly binanceService: BinanceMainService,
    private readonly prisma: PrismaService,
  ) { }

  // ===== CRUD PORTAFOLIOS =====

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