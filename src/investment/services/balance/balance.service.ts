import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
    MonthlyBalance, ExpenseDetail, BalanceSummary, CreateMonthlyBalancePayload, CreateExpenseDetailPayload,
} from 'src/investment/interfaces/balance.interface';

@Injectable()
export class BalanceService {
    private supabase: SupabaseClient;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Environment variables SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
        }

        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    async createMonthlyBalance(
        userId: string,
        payload: CreateMonthlyBalancePayload
    ): Promise<MonthlyBalance> {
        const { data: existing } = await this.supabase
            .from('monthly_balances')
            .select('id')
            .eq('user_id', userId)
            .eq('year', payload.year)
            .eq('month', payload.month)
            .maybeSingle();

        if (existing) {
            throw new BadRequestException(
                `Balance for ${payload.month} ${payload.year} already exists`
            );
        }

        const { data: balance, error: balanceError } = await this.supabase
            .from('monthly_balances')
            .insert({
                user_id: userId,
                year: payload.year,
                month: payload.month,
                gross_salary: payload.grossSalary,
                dollar_amount: payload.dollarAmount,
                max_salary_last_six_months: payload.maxSalaryLastSixMonths || null,
            })
            .select()
            .single();

        if (balanceError) {
            throw new BadRequestException(balanceError.message);
        }

        if (payload.expenseDetails && payload.expenseDetails.length > 0) {
            const expenseDetailsToInsert = payload.expenseDetails.map(detail => ({
                monthly_balance_id: balance.id,
                type: detail.type,
                concept: detail.concept,
                amount_ars: detail.amountARS || 0,
                amount_usd: detail.amountUSD || 0,
                fee_current: detail.feeCurrent || null,
                fee_total: detail.feeTotal || null,
                selected: detail.selected || false,
            }));

            const { error: detailsError } = await this.supabase
                .from('expense_details')
                .insert(expenseDetailsToInsert);

            if (detailsError) {
                await this.supabase.from('monthly_balances').delete().eq('id', balance.id);
                throw new BadRequestException(detailsError.message);
            }
        }

        return this.getMonthlyBalanceById(userId, balance.id);
    }

    async getAllMonthlyBalances(userId: string): Promise<MonthlyBalance[]> {
        const { data, error } = await this.supabase
            .from('monthly_balances')
            .select(`
        *,
        expense_details:expense_details(*)
      `)
            .eq('user_id', userId)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (error) {
            throw new BadRequestException(error.message);
        }

        return data as MonthlyBalance[];
    }

    async getMonthlyBalanceById(userId: string, balanceId: string): Promise<MonthlyBalance> {
        const { data, error } = await this.supabase
            .from('monthly_balances')
            .select(`
        *,
        expense_details:expense_details(*)
      `)
            .eq('id', balanceId)
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Monthly balance not found');
        }

        return data as MonthlyBalance;
    }

    async getMonthlyBalanceByPeriod(
        userId: string,
        year: number,
        month: string
    ): Promise<MonthlyBalance> {
        const { data, error } = await this.supabase
            .from('monthly_balances')
            .select(`
        *,
        expense_details:expense_details(*)
      `)
            .eq('user_id', userId)
            .eq('year', year)
            .eq('month', month)
            .maybeSingle();

        if (error || !data) {
            throw new NotFoundException(`Balance for ${month} ${year} not found`);
        }

        return data as MonthlyBalance;
    }

    async updateMonthlyBalance(
        userId: string,
        balanceId: string,
        payload: Partial<CreateMonthlyBalancePayload>
    ): Promise<MonthlyBalance> {
        const { expenseDetails, ...balanceUpdate } = payload;

        if (Object.keys(balanceUpdate).length > 0) {
            const updateData: any = {};
            if (balanceUpdate.year !== undefined) updateData.year = balanceUpdate.year;
            if (balanceUpdate.month !== undefined) updateData.month = balanceUpdate.month;
            if (balanceUpdate.grossSalary !== undefined) updateData.gross_salary = balanceUpdate.grossSalary;
            if (balanceUpdate.dollarAmount !== undefined) updateData.dollar_amount = balanceUpdate.dollarAmount;
            if (balanceUpdate.maxSalaryLastSixMonths !== undefined) {
                updateData.max_salary_last_six_months = balanceUpdate.maxSalaryLastSixMonths;
            }

            const { error } = await this.supabase
                .from('monthly_balances')
                .update(updateData)
                .eq('id', balanceId)
                .eq('user_id', userId);

            if (error) {
                throw new BadRequestException(error.message);
            }
        }

        if (expenseDetails !== undefined) {
            await this.supabase
                .from('expense_details')
                .delete()
                .eq('monthly_balance_id', balanceId);

            if (expenseDetails.length > 0) {
                const expenseDetailsToInsert = expenseDetails.map(detail => ({
                    monthly_balance_id: balanceId,
                    type: detail.type,
                    concept: detail.concept,
                    amount_ars: detail.amountARS || 0,
                    amount_usd: detail.amountUSD || 0,
                    fee_current: detail.feeCurrent || null,
                    fee_total: detail.feeTotal || null,
                    selected: detail.selected || false,
                }));

                const { error: detailsError } = await this.supabase
                    .from('expense_details')
                    .insert(expenseDetailsToInsert);

                if (detailsError) {
                    throw new BadRequestException(detailsError.message);
                }
            }
        }

        return this.getMonthlyBalanceById(userId, balanceId);
    }

    async deleteMonthlyBalance(userId: string, balanceId: string): Promise<void> {
        const { error } = await this.supabase
            .from('monthly_balances')
            .delete()
            .eq('id', balanceId)
            .eq('user_id', userId);

        if (error) {
            throw new BadRequestException(error.message);
        }
    }

    async updateExpenseDetail(
        userId: string,
        detailId: string,
        payload: Partial<CreateExpenseDetailPayload>
    ): Promise<ExpenseDetail> {
        const { data: detail } = await this.supabase
            .from('expense_details')
            .select('monthly_balance_id')
            .eq('id', detailId)
            .maybeSingle();

        if (!detail) {
            throw new NotFoundException('Expense detail not found');
        }

        const { data: balance } = await this.supabase
            .from('monthly_balances')
            .select('id')
            .eq('id', detail.monthly_balance_id)
            .eq('user_id', userId)
            .maybeSingle();

        if (!balance) {
            throw new NotFoundException('Expense detail not found');
        }

        const updateData: any = {};
        if (payload.type !== undefined) updateData.type = payload.type;
        if (payload.concept !== undefined) updateData.concept = payload.concept;
        if (payload.amountARS !== undefined) updateData.amount_ars = payload.amountARS;
        if (payload.amountUSD !== undefined) updateData.amount_usd = payload.amountUSD;
        if (payload.feeCurrent !== undefined) updateData.fee_current = payload.feeCurrent;
        if (payload.feeTotal !== undefined) updateData.fee_total = payload.feeTotal;
        if (payload.selected !== undefined) updateData.selected = payload.selected;

        const { data: updatedDetail, error } = await this.supabase
            .from('expense_details')
            .update(updateData)
            .eq('id', detailId)
            .select()
            .single();

        if (error) {
            throw new BadRequestException(error.message);
        }

        return updatedDetail as ExpenseDetail;
    }

    async deleteExpenseDetail(userId: string, detailId: string): Promise<void> {
        const { data: detail } = await this.supabase
            .from('expense_details')
            .select('monthly_balance_id')
            .eq('id', detailId)
            .maybeSingle();

        if (!detail) {
            throw new NotFoundException('Expense detail not found');
        }

        const { data: balance } = await this.supabase
            .from('monthly_balances')
            .select('id')
            .eq('id', detail.monthly_balance_id)
            .eq('user_id', userId)
            .maybeSingle();

        if (!balance) {
            throw new NotFoundException('Expense detail not found');
        }

        const { error } = await this.supabase
            .from('expense_details')
            .delete()
            .eq('id', detailId);

        if (error) {
            throw new BadRequestException(error.message);
        }
    }

    async getBalanceSummary(userId: string, balanceId: string): Promise<BalanceSummary> {
        const balance = await this.getMonthlyBalanceById(userId, balanceId);

        const income = balance.expenseDetails?.filter(d => d.type === 'income') || [];
        const expenses = balance.expenseDetails?.filter(d => d.type === 'expense') || [];

        const incomeARS = income.reduce((sum, item) => sum + (item.amountARS || 0), 0);
        const incomeUSD = income.reduce((sum, item) => sum + (item.amountUSD || 0), 0);
        const expensesARS = expenses.reduce((sum, item) => sum + (item.amountARS || 0), 0);
        const expensesUSD = expenses.reduce((sum, item) => sum + (item.amountUSD || 0), 0);

        const totalIncome = incomeARS + (incomeUSD * balance.dollarAmount);
        const totalExpenses = expensesARS + (expensesUSD * balance.dollarAmount);

        return {
            totalIncome,
            totalExpenses,
            netBalance: balance.grossSalary + totalIncome - totalExpenses,
            incomeARS,
            incomeUSD,
            expensesARS,
            expensesUSD,
        };
    }

    async bulkCreateMonthlyBalances(
        userId: string,
        balances: CreateMonthlyBalancePayload[]
    ): Promise<MonthlyBalance[]> {
        const results: MonthlyBalance[] = [];

        for (const balancePayload of balances) {
            try {
                const balance = await this.createMonthlyBalance(userId, balancePayload);
                results.push(balance);
            } catch (error) {
                console.error(`Error creating balance for ${balancePayload.month} ${balancePayload.year}:`, error.message);
            }
        }

        return results;
    }
}