export interface MonthlyBalance {
    id: string;
    userId: string;
    year: number;
    month: string;
    grossSalary: number;
    dollarAmount: number;
    maxSalaryLastSixMonths?: number;
    createdAt: Date;
    updatedAt: Date;
    expenseDetails?: ExpenseDetail[];
}

export interface ExpenseDetail {
    id: string;
    monthlyBalanceId: string;
    type: 'income' | 'expense';
    concept: string;
    amountARS: number;
    amountUSD: number;
    feeCurrent?: number;
    feeTotal?: number;
    selected: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface BalanceSummary {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    incomeARS: number;
    incomeUSD: number;
    expensesARS: number;
    expensesUSD: number;
}

export interface CreateMonthlyBalancePayload {
    year: number;
    month: string;
    grossSalary: number;
    dollarAmount: number;
    maxSalaryLastSixMonths?: number;
    expenseDetails: CreateExpenseDetailPayload[];
}

export interface CreateExpenseDetailPayload {
    type: 'income' | 'expense';
    concept: string;
    amountARS?: number;
    amountUSD?: number;
    feeCurrent?: number;
    feeTotal?: number;
    selected?: boolean;
}