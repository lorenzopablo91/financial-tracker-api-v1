import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { DashboardService } from 'src/investment/services/dashboard/dashboard.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {

    constructor(private readonly dashboardService: DashboardService) { }

    // ===== PRECIO SIMPLE =====

    // GET /api/dashboard/crypto/prices?symbols=BTC,ETH,SOL
    @Get('crypto/prices')
    async getMultiplePrices(@Query('symbols') symbols: string) {
        const symbolList = symbols.split(',').map(s => s.trim());
        const data = await firstValueFrom(this.dashboardService.getMultipleTickerPrices(symbolList));
        return { success: true, data };
    }

    // GET /api/dashboard/crypto/:symbol/price
    @Get('crypto/:symbol/price')
    async getTickerPrice(@Param('symbol') symbol: string) {
        const data = await firstValueFrom(this.dashboardService.getTickerPrice(symbol));
        return { success: true, data };
    }

    // ===== TICKER COMPLETO (precio + variación 24h) =====

    // GET /api/dashboard/crypto/tickers?symbols=BTC,ETH,SOL
    @Get('crypto/tickers')
    async getMultipleTickers(@Query('symbols') symbols: string) {
        const symbolList = symbols.split(',').map(s => s.trim());
        const data = await firstValueFrom(this.dashboardService.getMultipleTickerData(symbolList));
        return { success: true, data };
    }

    // GET /api/dashboard/crypto/:symbol/24hr
    @Get('crypto/:symbol/24hr')
    async getTickerData(@Param('symbol') symbol: string) {
        const data = await firstValueFrom(this.dashboardService.getTickerData(symbol));
        return { success: true, data: data[0] ?? null };
    }

    // ===== SSE STREAM =====

    // GET /api/dashboard/crypto/stream
    @Get('crypto/stream')
    streamCryptoPrices(@Res() res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const subscription = this.dashboardService.getCryptoDashboardStream().subscribe({
            next: (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            },
            error: (err) => {
                res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
                res.end();
            },
            complete: () => res.end(),
        });

        res.on('close', () => subscription.unsubscribe());
    }
}