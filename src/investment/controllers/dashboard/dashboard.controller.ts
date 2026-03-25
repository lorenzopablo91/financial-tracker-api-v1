import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { DashboardService } from 'src/investment/services/dashboard/dashboard.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {

    constructor(private readonly dashboardService: DashboardService) { }

    // GET /api/dashboard/stream
    @Get('stream')
    streamDashboard(@Res() res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const subscription = this.dashboardService.getDashboardStream().subscribe({
            next: (payload) => {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            },
            error: (err) => {
                res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
                res.end();
            },
            complete: () => res.end(),
        });

        res.on('close', () => {
            subscription.unsubscribe();
            this.dashboardService['logger'].log('Cliente desconectado del stream');
        });
    }
}