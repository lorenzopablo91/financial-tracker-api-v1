import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AbmService } from './abm.service';

@Injectable()
export class CapitalService {
  constructor(
    private readonly abmService: AbmService,
    private readonly prisma: PrismaService,
  ) { }

  // ===== OPERACIONES DE CAPITAL =====

  async registrarAporte(portafolioId: string, data: {
    montoUSD: number;
    notas?: string;
    fecha?: Date;
  }) {
    await this.abmService.obtenerPortafolio(portafolioId);

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
    const portafolio = await this.abmService.obtenerPortafolio(portafolioId);

    const capitalActual = Number(portafolio.capitalInicial);

    if (data.montoUSD > capitalActual) {
      throw new BadRequestException(
        `No puedes retirar $${data.montoUSD}. Capital disponible: $${capitalActual}`
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