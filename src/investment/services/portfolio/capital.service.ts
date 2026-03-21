import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PortfolioService } from './portfolio.service';

@Injectable()
export class CapitalService {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly prisma: PrismaService,
  ) { }

  // ===== OPERACIONES DE CAPITAL =====

  async registrarAporte(portafolioId: string, data: {
    montoUSD: number;
    notas?: string;
    fecha?: Date;
  }) {
    await this.portfolioService.obtenerPortafolio(portafolioId);

    // Crear registro de operación
    const operacion = await this.prisma.operacion.create({
      data: {
        portafolioId,
        tipo: 'APORTE',
        montoUSD: data.montoUSD,
        notas: data.notas,
        fecha: data.fecha || new Date()
      }
    });

    // Actualizar capital inicial del portfolio
    await this.prisma.portafolio.update({
      where: { id: portafolioId },
      data: {
        capitalInicial: {
          increment: data.montoUSD
        }
      }
    });

    return {
      operacion,
      mensaje: `Aporte de $${data.montoUSD} registrado exitosamente`
    };
  }

  async registrarRetiro(portafolioId: string, data: {
    montoUSD: number;
    notas?: string;
    fecha?: Date;
  }) {
    const portafolio = await this.portfolioService.obtenerPortafolio(portafolioId);

    const efectivoDisponible = await this.portfolioService.obtenerEfectivoDisponible(portafolioId);

    if (data.montoUSD > efectivoDisponible + 0.01) {
      throw new BadRequestException(
        `No puedes retirar $${data.montoUSD}. Efectivo disponible líquido: $${efectivoDisponible.toFixed(2)}`
      );
    }

    const operacion = await this.prisma.operacion.create({
      data: {
        portafolioId,
        tipo: 'RETIRO',
        montoUSD: data.montoUSD,
        notas: data.notas,
        fecha: data.fecha || new Date()
      }
    });

    await this.prisma.portafolio.update({
      where: { id: portafolioId },
      data: {
        capitalInicial: {
          decrement: data.montoUSD
        }
      }
    });

    return {
      operacion,
      mensaje: `Retiro de $${data.montoUSD} registrado exitosamente`
    };
  }

}