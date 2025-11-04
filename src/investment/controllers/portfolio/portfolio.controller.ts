import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { PortfolioService } from 'src/investment/services/portfolio/portfolio.service';

@Controller('api/portfolio')
export class PortfolioController {

  constructor(
    private readonly portfolioService: PortfolioService,
    private prisma: PrismaService) { }

  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  }

}