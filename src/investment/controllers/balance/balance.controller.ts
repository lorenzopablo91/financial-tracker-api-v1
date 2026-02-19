import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards, } from '@nestjs/common';
import { GetUser } from 'src/auth/decorators/get-user.decorador';
import { Role, Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import type { CreateMonthlyBalancePayload, CreateExpenseDetailPayload } from 'src/investment/interfaces/balance.interface';
import { BalanceService } from 'src/investment/services/balance/balance.service';

@Controller('api/balance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BalanceController {
    constructor(private readonly balanceService: BalanceService) { }

    @Post()
    @Roles(Role.ADMIN)
    async createMonthlyBalance(
        @GetUser('id') userId: string,
        @Body() payload: CreateMonthlyBalancePayload
    ) {
        const balance = await this.balanceService.createMonthlyBalance(userId, payload);
        return {
            success: true,
            data: balance,
        };
    }

    @Get()
    @Roles(Role.ADMIN, Role.VIEWER)
    async getAllMonthlyBalances(@GetUser('id') userId: string) {
        const balances = await this.balanceService.getAllMonthlyBalances(userId);
        return {
            success: true,
            data: balances,
            count: balances.length,
        };
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.VIEWER)
    async getMonthlyBalanceById(
        @GetUser('id') userId: string,
        @Param('id') id: string
    ) {
        const balance = await this.balanceService.getMonthlyBalanceById(userId, id);
        return {
            success: true,
            data: balance,
        };
    }

    @Get('period/:year/:month')
    @Roles(Role.ADMIN, Role.VIEWER)
    async getMonthlyBalanceByPeriod(
        @GetUser('id') userId: string,
        @Param('year') year: string,
        @Param('month') month: string
    ) {
        const balance = await this.balanceService.getMonthlyBalanceByPeriod(
            userId,
            parseInt(year),
            month
        );
        return {
            success: true,
            data: balance,
        };
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    async updateMonthlyBalance(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() payload: Partial<CreateMonthlyBalancePayload>
    ) {
        const balance = await this.balanceService.updateMonthlyBalance(userId, id, payload);
        return {
            success: true,
            data: balance,
        };
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteMonthlyBalance(
        @GetUser('id') userId: string,
        @Param('id') id: string
    ) {
        await this.balanceService.deleteMonthlyBalance(userId, id);
    }

    @Put('expense-detail/:id')
    @Roles(Role.ADMIN)
    async updateExpenseDetail(
        @GetUser('id') userId: string,
        @Param('id') id: string,
        @Body() payload: Partial<CreateExpenseDetailPayload>
    ) {
        const detail = await this.balanceService.updateExpenseDetail(userId, id, payload);
        return {
            success: true,
            data: detail,
        };
    }

    @Delete('expense-detail/:id')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteExpenseDetail(
        @GetUser('id') userId: string,
        @Param('id') id: string
    ) {
        await this.balanceService.deleteExpenseDetail(userId, id);
    }

    @Post(':id/expense-detail')
    @Roles(Role.ADMIN)
    async addExpenseDetail(
        @GetUser('id') userId: string,
        @Param('id') balanceId: string,
        @Body() payload: Partial<CreateExpenseDetailPayload>
    ) {
        const detail = await this.balanceService.addExpenseDetail(userId, balanceId, payload);
        return {
            success: true,
            data: detail,
        };
    }
}