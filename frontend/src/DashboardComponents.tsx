import { useState } from "react";

import type {
  BillingCycle,
  BillingCyclePayment,
  ExpenseCategory,
  ExpenseItem,
  Paycheck,
} from "./types";

interface DashboardHeaderProps {
  onAddPaycheck: () => void;
  onAddCategory: () => void;
}

export function DashboardHeader({
  onAddPaycheck,
  onAddCategory,
}: DashboardHeaderProps) {
  return (
    <header className="dashboard-header">
      <div>
        <span className="eyebrow">Your money, at a glance</span>
        <h1>Dashboard</h1>
        <p>Track paychecks, manage expenses, and stay on budget.</p>
      </div>
      <div className="header-actions">
        <button type="button" onClick={onAddPaycheck}>
          <span aria-hidden="true">+</span> Add paycheck
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={onAddCategory}
        >
          <span aria-hidden="true">+</span> Add category
        </button>
      </div>
    </header>
  );
}

interface PayPeriodSelectorProps {
  paychecks: Paycheck[];
  selectedPaycheckId: string;
  onChange: (paycheckId: string) => void;
}

function formatPeriodDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function PayPeriodSelector({
  paychecks,
  selectedPaycheckId,
  onChange,
}: PayPeriodSelectorProps) {
  if (paychecks.length === 0) {
    return (
      <p className="selector-empty">Add your first paycheck to begin.</p>
    );
  }

  return (
    <label className="period-select-label">
      <span className="visually-hidden">Select a paycheck period</span>
      <select
        value={selectedPaycheckId}
        onChange={(event) => onChange(event.target.value)}
      >
        {paychecks.map((paycheck) => (
          <option key={paycheck.id} value={paycheck.id}>
            {formatPeriodDate(paycheck.period_start)} –{" "}
            {formatPeriodDate(paycheck.period_end)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface PaycheckSummaryProps {
  paycheck: Paycheck | undefined;
  isCurrent: boolean;
  nextPaycheckDate: string | undefined;
  isNextPaycheckRecorded: boolean;
}

function formatCurrency(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function relativeDate(value: string): string {
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "In 1 day";
  if (days === -1) return "1 day ago";
  return days > 0 ? `In ${days} days` : `${Math.abs(days)} days ago`;
}

export function PaycheckSummary({
  paycheck,
  isCurrent,
  nextPaycheckDate,
  isNextPaycheckRecorded,
}: PaycheckSummaryProps) {
  return (
    <section className="summary-grid" aria-label="Paycheck summary">
      <article className="summary-card paycheck-card">
        <div className="summary-icon summary-icon-success" aria-hidden="true">
          ✓
        </div>
        <div className="summary-content">
          <div className="summary-title-row">
            <h2>{isCurrent ? "Current paycheck" : "Selected paycheck"}</h2>
            {paycheck && (
              <span className={`period-status ${isCurrent ? "active" : ""}`}>
                {isCurrent ? "Current" : "Historical"}
              </span>
            )}
          </div>
          {paycheck ? (
            <>
              <p className="summary-amount">{formatCurrency(paycheck.amount)}</p>
              <p className="summary-caption">
                Pay period: {formatDate(paycheck.period_start)} –{" "}
                {formatDate(paycheck.period_end)}
              </p>
              <p className="summary-caption">
                Pay date: {formatDate(paycheck.pay_date)}
              </p>
            </>
          ) : (
            <p className="summary-empty">
              No paycheck yet. Add one to start tracking your pay periods.
            </p>
          )}
        </div>
      </article>

      <article className="summary-card next-card">
        <div className="summary-icon summary-icon-primary" aria-hidden="true">
          ▦
        </div>
        <div className="summary-content">
          <h2>Next paycheck</h2>
          {nextPaycheckDate ? (
            <>
              <p className="summary-amount">{formatDate(nextPaycheckDate)}</p>
              <p className="summary-caption">
                {relativeDate(nextPaycheckDate)}
                {!isNextPaycheckRecorded && " · Based on the bi-weekly pay period"}
              </p>
            </>
          ) : (
            <p className="summary-empty">
              Add a paycheck to see the next pay date.
            </p>
          )}
        </div>
      </article>
    </section>
  );
}

interface VariableExpensesPanelProps {
  categories: ExpenseCategory[];
  expenses: ExpenseItem[];
  expensesLoading: boolean;
  hasPaycheck: boolean;
  onAddExpense: (categoryId?: string) => void;
  onDeleteExpense: (expenseId: string) => void;
  deletingExpenseId: string;
}

export function VariableExpensesPanel({
  categories,
  expenses,
  expensesLoading,
  hasPaycheck,
  onAddExpense,
  onDeleteExpense,
  deletingExpenseId,
}: VariableExpensesPanelProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  function toggleCategory(categoryId: string) {
    setExpandedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  return (
    <section className="panel expense-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-icon" aria-hidden="true">▮</span>
          <h2>Expenses</h2>
          <p>Track your spending against budgets for everyday expenses.</p>
        </div>
        <button
          type="button"
          className="button-secondary compact-button"
          onClick={() => onAddExpense()}
          disabled={!hasPaycheck || categories.length === 0}
        >
          <span aria-hidden="true">+</span> Add expense
        </button>
      </div>

      {!hasPaycheck ? (
        <p className="empty-state">Add a paycheck to view period expenses.</p>
      ) : expensesLoading ? (
        <p className="empty-state" role="status">Loading expenses...</p>
      ) : categories.length === 0 ? (
        <p className="empty-state">
          No variable expense categories yet. Add a category to get started.
        </p>
      ) : (
        <div className="category-list">
          {categories.map((category) => {
            const categoryExpenses = expenses
              .filter((expense) => expense.category_id === category.id)
              .sort(
                (a, b) =>
                  b.spent_on.localeCompare(a.spent_on) ||
                  b.created_at.localeCompare(a.created_at),
              );
            const spent = categoryExpenses.reduce(
              (total, expense) => total + Number(expense.amount),
              0,
            );
            const budget =
              category.budget === null ? null : Number(category.budget);
            const progress =
              budget === null || budget <= 0
                ? 0
                : Math.min((spent / budget) * 100, 100);
            const utilization =
              budget === null || budget <= 0
                ? 0
                : Math.round((spent / budget) * 100);
            const isExpanded = expandedCategories.includes(category.id);
            const latestExpense = categoryExpenses[0];

            return (
              <article className="expense-category" key={category.id}>
                <div className="category-symbol" aria-hidden="true">
                  {category.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="expense-category-body">
                  <div className="expense-category-heading">
                    <div>
                      <h3>{category.name}</h3>
                      <p className="amount-caption">
                        {formatCurrency(spent)} spent
                        {budget !== null && ` of ${formatCurrency(budget)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onAddExpense(category.id)}
                      disabled={!hasPaycheck}
                    >
                      Add expense
                    </button>
                  </div>

                  {budget !== null && (
                    <div className="budget-progress-row">
                      <div
                        className={`budget-progress ${
                          spent > budget ? "over-budget" : ""
                        }`}
                        role="progressbar"
                        aria-label={`${category.name} budget used`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <span className="progress-label">
                        {utilization}%
                      </span>
                    </div>
                  )}

                  {latestExpense ? (
                    <p className="latest-expense">
                      Latest: {latestExpense.name} ·{" "}
                      {formatCurrency(latestExpense.amount)} ·{" "}
                      {formatDate(latestExpense.spent_on)}
                    </p>
                  ) : (
                    <p className="latest-expense">No expenses this period.</p>
                  )}

                  {categoryExpenses.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="text-button view-all-button"
                        aria-expanded={isExpanded}
                        onClick={() => toggleCategory(category.id)}
                      >
                        {isExpanded ? "Hide expenses" : "View all"}
                      </button>
                      {isExpanded && (
                        <ul className="expense-item-list">
                          {categoryExpenses.map((expense) => (
                            <li key={expense.id}>
                              <div>
                                <strong>{expense.name}</strong>
                                <span>{formatDate(expense.spent_on)}</span>
                              </div>
                              <strong>{formatCurrency(expense.amount)}</strong>
                              <button
                                type="button"
                                className="delete-button"
                                onClick={() => onDeleteExpense(expense.id)}
                                disabled={deletingExpenseId === expense.id}
                                aria-label={`Delete ${expense.name}`}
                              >
                                {deletingExpenseId === expense.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface RecurringBillsPanelProps {
  categories: ExpenseCategory[];
  billingCycles: BillingCycle[];
  billingPayments: BillingCyclePayment[];
  paycheckId: string | undefined;
  onAddBill: () => void;
}

export function RecurringBillsPanel({
  categories,
  billingCycles,
  billingPayments,
  paycheckId,
  onAddBill,
}: RecurringBillsPanelProps) {
  return (
    <section className="panel recurring-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-icon recurring-icon" aria-hidden="true">↻</span>
          <h2>Recurring Bills</h2>
          <p>Your regular bills and subscriptions.</p>
        </div>
        <button
          type="button"
          className="button-secondary compact-button"
          onClick={onAddBill}
          disabled={categories.length === 0}
        >
          <span aria-hidden="true">+</span> Add bill
        </button>
      </div>

      {categories.length === 0 ? (
        <p className="empty-state">
          No recurring categories yet. Add a fixed or variable recurring
          category to get started.
        </p>
      ) : (
        <div className="bill-list">
          {categories.map((category) => {
            const latestCycle = billingCycles
              .filter((cycle) => cycle.category_id === category.id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
            const statusLabel = latestCycle
              ? {
                  RECORDED: "Bill Recorded",
                  FIRST_HALF_PAID: "First Half Paid",
                  COMPLETE: "Complete",
                }[latestCycle.status]
              : "No bill recorded";
            const allocated = latestCycle
              ? billingPayments
                  .filter(
                    (payment) =>
                      payment.billing_cycle_id === latestCycle.id &&
                      payment.paycheck_id === paycheckId,
                  )
                  .reduce(
                    (total, payment) => total + Number(payment.amount),
                    0,
                  )
              : 0;

            return (
              <article className="bill-card" key={category.id}>
                <div className="bill-status-icon" aria-hidden="true">
                  {latestCycle?.status === "COMPLETE" ? "✓" : "↻"}
                </div>
                <div className="bill-details">
                  <div className="bill-title-row">
                    <h3>{category.name}</h3>
                    <span
                      className={`bill-status ${
                        latestCycle?.status === "COMPLETE"
                          ? "complete"
                          : latestCycle
                            ? "pending"
                            : "muted"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="bill-amounts">
                    {category.expected_amount !== null && (
                      <span>
                        Expected {formatCurrency(category.expected_amount)}
                      </span>
                    )}
                    {latestCycle ? (
                      <span>
                        Latest bill {formatCurrency(latestCycle.total_amount)}
                      </span>
                    ) : (
                      <span>Waiting for first bill</span>
                    )}
                    {allocated > 0 && (
                      <span>
                        This period {formatCurrency(allocated)} allocated
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
