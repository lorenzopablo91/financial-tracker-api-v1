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
  ) {
  }

}