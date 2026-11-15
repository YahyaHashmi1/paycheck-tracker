import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { apiRequest, getJson, postJson } from "./api";
import {
  DashboardHeader,
  PayPeriodSelector,
  PaycheckSummary,
  RecurringBillsPanel,
  VariableExpensesPanel,
} from "./DashboardComponents";
import type {
  BillingCycle,
  BillingCycleCreate,
  BillingCyclePayment,
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseItem,
  ExpenseItemCreate,
  Paycheck,
  PaycheckCreate,
} from "./types";

import "./App.css";

const USER_ID = import.meta.env.VITE_DEMO_USER_ID;

type CategoryType = ExpenseCategory["type"];
type ActiveDialog = "paycheck" | "category" | "expense" | "bill" | null;

function getToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [selectedPaycheckId, setSelectedPaycheckId] = useState("");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);
  const [billingPayments, setBillingPayments] = useState<
    BillingCyclePayment[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [saving, setSaving] = useState("");
  const [deletingExpenseId, setDeletingExpenseId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  const [paycheckAmount, setPaycheckAmount] = useState("");
  const [payDate, setPayDate] = useState(getToday());

  const [categoryType, setCategoryType] = useState<CategoryType | "">("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryBudget, setCategoryBudget] = useState("");
  const [categoryExpectedAmount, setCategoryExpectedAmount] = useState("");

  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [spentOn, setSpentOn] = useState(getToday());

  const [billingCategoryId, setBillingCategoryId] = useState("");
  const [billingTotalAmount, setBillingTotalAmount] = useState("");

  const selectedPaycheck = paychecks.find(
    (paycheck) => paycheck.id === selectedPaycheckId,
  ) ?? paychecks[0];

  const regularCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === "VARIABLE_NON_RECURRING",
      ),
    [categories],
  );

  const recurringCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === "FIXED_RECURRING" ||
          category.type === "VARIABLE_RECURRING",
      ),
    [categories],
  );

  const effectiveExpenseCategoryId = regularCategories.some(
    (category) => category.id === expenseCategoryId,
  )
    ? expenseCategoryId
    : regularCategories[0]?.id ?? "";

  const effectiveBillingCategoryId = recurringCategories.some(
    (category) => category.id === billingCategoryId,
  )
    ? billingCategoryId
    : recurringCategories[0]?.id ?? "";

  const selectedPaycheckForExpenses = selectedPaycheck?.id;

  const isCurrentPaycheck =
    selectedPaycheck !== undefined && selectedPaycheck.id === paychecks[0]?.id;

  const nextRecordedPaycheck = selectedPaycheck
    ? paychecks
        .filter((paycheck) => paycheck.pay_date > selectedPaycheck.pay_date)
        .sort((a, b) => a.pay_date.localeCompare(b.pay_date))[0]
    : undefined;

  const nextPaycheckDate =
    nextRecordedPaycheck?.pay_date ?? selectedPaycheck?.period_end;

  const loadDashboard = useCallback(async () => {
    if (!USER_ID) {
      throw new Error(
        "Set VITE_DEMO_USER_ID in frontend/.env to your existing user UUID.",
      );
    }

    const [paycheckData, categoryData] = await Promise.all([
      getJson<Paycheck[]>("/paychecks"),
      getJson<ExpenseCategory[]>(
        `/expense-categories?user_id=${encodeURIComponent(USER_ID)}`,
      ),
    ]);

    const userPaychecks = paycheckData
      .filter((paycheck) => paycheck.user_id === USER_ID)
      .sort((a, b) => b.pay_date.localeCompare(a.pay_date));
    const activeCategories = categoryData.filter((category) => category.active);
    const availableRecurringCategories = activeCategories.filter(
      (category) =>
        category.type === "FIXED_RECURRING" ||
        category.type === "VARIABLE_RECURRING",
    );
    const selectedRecurringCategory = availableRecurringCategories[0];

    setPaychecks(userPaychecks);
    setSelectedPaycheckId((previousId) =>
      userPaychecks.some((paycheck) => paycheck.id === previousId)
        ? previousId
        : userPaychecks[0]?.id ?? "",
    );
    setCategories(activeCategories);
    setBillingCategoryId(selectedRecurringCategory?.id ?? "");
    setBillingTotalAmount(
      selectedRecurringCategory?.type === "FIXED_RECURRING"
        ? selectedRecurringCategory.expected_amount ?? ""
        : "",
    );
  }, []);

  const loadBillingData = useCallback(async () => {
    if (!USER_ID) {
      throw new Error(
        "Set VITE_DEMO_USER_ID in frontend/.env to your existing user UUID.",
      );
    }

    const cycles = await getJson<BillingCycle[]>(
      `/billing-cycles?user_id=${encodeURIComponent(USER_ID)}`,
    );

    const paymentGroups = await Promise.all(
      cycles.map((cycle) =>
        getJson<BillingCyclePayment[]>(
          `/billing-cycle-payments?billing_cycle_id=${encodeURIComponent(
            cycle.id,
          )}`,
        ),
      ),
    );

    setBillingCycles(cycles);
    setBillingPayments(paymentGroups.flat());
  }, []);

  useEffect(() => {
    async function initializeDashboard() {
      try {
        await Promise.all([loadDashboard(), loadBillingData()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the dashboard.",
        );
      } finally {
        setLoading(false);
      }
    }

    void initializeDashboard();
  }, [loadDashboard, loadBillingData]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedExpenses() {
      if (!selectedPaycheckForExpenses) {
        setExpenses([]);
        setExpensesLoading(false);
        return;
      }

      setExpensesLoading(true);
      try {
        const data = await getJson<ExpenseItem[]>(
          `/expense-items?paycheck_id=${encodeURIComponent(
            selectedPaycheckForExpenses,
          )}`,
        );

        if (!cancelled) {
          setExpenses(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load expenses.",
          );
        }
      } finally {
        if (!cancelled) {
          setExpensesLoading(false);
        }
      }
    }

    void loadSelectedExpenses();

    return () => {
      cancelled = true;
    };
  }, [selectedPaycheckForExpenses]);

  async function handleAddPaycheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("paycheck");
    setError("");
    setMessage("");

    try {
      if (!USER_ID) {
        throw new Error("Configure VITE_DEMO_USER_ID in frontend/.env.");
      }

      const data: PaycheckCreate = {
        user_id: USER_ID,
        amount: paycheckAmount,
        pay_date: payDate,
      };

      const createdPaycheck = await postJson<Paycheck, PaycheckCreate>(
        "/paychecks",
        data,
      );

      await Promise.all([loadDashboard(), loadBillingData()]);
      setSelectedPaycheckId(createdPaycheck.id);
      setPaycheckAmount("");
      setPayDate(getToday());
      setActiveDialog(null);
      setMessage("Paycheck added successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add paycheck.",
      );
    } finally {
      setSaving("");
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("category");
    setError("");
    setMessage("");

    try {
      if (!USER_ID) {
        throw new Error("Configure VITE_DEMO_USER_ID in frontend/.env.");
      }
      if (!categoryType) {
        throw new Error("Select a category type.");
      }

      const data: ExpenseCategoryCreate = {
        user_id: USER_ID,
        name: categoryName.trim(),
        type: categoryType,
        active: true,
        budget:
          categoryType === "VARIABLE_NON_RECURRING" &&
          categoryBudget.trim() !== ""
            ? categoryBudget
            : null,
        expected_amount:
          categoryType === "FIXED_RECURRING"
            ? categoryExpectedAmount
            : null,
      };

      await postJson<ExpenseCategory, ExpenseCategoryCreate>(
        "/expense-categories",
        data,
      );
      await loadDashboard();

      setCategoryType("");
      setCategoryName("");
      setCategoryBudget("");
      setCategoryExpectedAmount("");
      setActiveDialog(null);
      setMessage("Expense category added successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add expense category.",
      );
    } finally {
      setSaving("");
    }
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("expense");
    setError("");
    setMessage("");

    if (!selectedPaycheck) {
      setError("Add a paycheck before adding expenses.");
      setSaving("");
      return;
    }

    try {
      const data: ExpenseItemCreate = {
        category_id: effectiveExpenseCategoryId,
        paycheck_id: selectedPaycheck.id,
        name: expenseName.trim(),
        amount: expenseAmount,
        spent_on: spentOn,
      };

      await postJson<ExpenseItem, ExpenseItemCreate>("/expense-items", data);

      const updatedExpenses = await getJson<ExpenseItem[]>(
        `/expense-items?paycheck_id=${encodeURIComponent(
          selectedPaycheck.id,
        )}`,
      );

      setExpenses(updatedExpenses);
      setExpenseName("");
      setExpenseAmount("");
      setSpentOn(getToday());
      setActiveDialog(null);
      setMessage("Expense added successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add expense.",
      );
    } finally {
      setSaving("");
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!window.confirm("Delete this expense? This action cannot be undone.")) {
      return;
    }

    setDeletingExpenseId(expenseId);
    setError("");
    setMessage("");

    try {
      await apiRequest<void>(`/expense-items/${encodeURIComponent(expenseId)}`, {
        method: "DELETE",
      });

      setExpenses((currentExpenses) =>
        currentExpenses.filter((expense) => expense.id !== expenseId),
      );
      setMessage("Expense deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete expense.",
      );
    } finally {
      setDeletingExpenseId("");
    }
  }

  async function handleAddRecurringBill(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving("billing");
    setError("");
    setMessage("");

    try {
      const data: BillingCycleCreate = {
        category_id: effectiveBillingCategoryId,
        total_amount: billingTotalAmount,
      };

      await postJson<BillingCycle, BillingCycleCreate>(
        "/billing-cycles",
        data,
      );
      await loadBillingData();

      setBillingTotalAmount("");
      setActiveDialog(null);
      setMessage("Recurring bill added successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add recurring bill.",
      );
    } finally {
      setSaving("");
    }
  }

  function openExpenseDialog(categoryId?: string) {
    if (categoryId) {
      setExpenseCategoryId(categoryId);
    }
    setActiveDialog("expense");
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-loading" role="status">
          Loading your dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <div className="dashboard">
        <DashboardHeader
          onAddPaycheck={() => setActiveDialog("paycheck")}
          onAddCategory={() => setActiveDialog("category")}
        />

        {error && !activeDialog && (
          <p className="feedback-message error-message" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="feedback-message success-message" role="status">
            {message}
          </p>
        )}

        <section className="period-toolbar" aria-label="Pay period selection">
          <div>
            <span className="eyebrow">Dashboard overview</span>
            <h2>Pay period</h2>
          </div>
          <PayPeriodSelector
            paychecks={paychecks}
            selectedPaycheckId={selectedPaycheck?.id ?? ""}
            onChange={(id) => {
              setSelectedPaycheckId(id);
              setError("");
              setMessage("");
            }}
          />
        </section>

        <PaycheckSummary
          paycheck={selectedPaycheck}
          isCurrent={isCurrentPaycheck}
          nextPaycheckDate={nextPaycheckDate}
          isNextPaycheckRecorded={nextRecordedPaycheck !== undefined}
        />

        <div className="dashboard-panels">
          <VariableExpensesPanel
            categories={regularCategories}
            expenses={expenses}
            expensesLoading={expensesLoading}
            hasPaycheck={selectedPaycheck !== undefined}
            onAddExpense={openExpenseDialog}
            onDeleteExpense={handleDeleteExpense}
            deletingExpenseId={deletingExpenseId}
          />
          <RecurringBillsPanel
            categories={recurringCategories}
            billingCycles={billingCycles}
            billingPayments={billingPayments}
            paycheckId={selectedPaycheck?.id}
            onAddBill={() => setActiveDialog("bill")}
          />
        </div>
      </div>

      {activeDialog && (
        <div
          className="dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && saving === "") {
              setActiveDialog(null);
            }
          }}
        >
          <section
            className="form-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && saving === "") {
                setActiveDialog(null);
              }
            }}
          >
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">Paycheck Tracker</span>
                <h2 id="dialog-title">
                  {activeDialog === "paycheck" && "Add paycheck"}
                  {activeDialog === "category" && "Add expense category"}
                  {activeDialog === "expense" && "Add expense"}
                  {activeDialog === "bill" && "Record a recurring bill"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close dialog"
                autoFocus
                onClick={() => setActiveDialog(null)}
                disabled={saving !== ""}
              >
                ×
              </button>
            </div>

            {error && (
              <p className="dialog-feedback error-message" role="alert">
                {error}
              </p>
            )}

            {activeDialog === "paycheck" && (
              <form onSubmit={handleAddPaycheck}>
                <label>
                  Paycheck amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paycheckAmount}
                    onChange={(event) => setPaycheckAmount(event.target.value)}
                    placeholder="3000.00"
                    required
                  />
                </label>
                <label>
                  Pay date
                  <input
                    type="date"
                    value={payDate}
                    onChange={(event) => setPayDate(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" disabled={saving !== ""}>
                  {saving === "paycheck" ? "Adding..." : "Add paycheck"}
                </button>
              </form>
            )}

            {activeDialog === "category" && (
              <form onSubmit={handleAddCategory}>
                <label>
                  Category type
                  <select
                    value={categoryType}
                    onChange={(event) => {
                      setCategoryType(event.target.value as CategoryType | "");
                      setCategoryName("");
                      setCategoryBudget("");
                      setCategoryExpectedAmount("");
                    }}
                    required
                  >
                    <option value="">Select a category type</option>
                    <option value="VARIABLE_NON_RECURRING">
                      Variable non-recurring
                    </option>
                    <option value="FIXED_RECURRING">Fixed recurring</option>
                    <option value="VARIABLE_RECURRING">
                      Variable recurring
                    </option>
                  </select>
                </label>

                {categoryType && (
                  <>
                    <label>
                      Category name
                      <input
                        type="text"
                        value={categoryName}
                        onChange={(event) => setCategoryName(event.target.value)}
                        placeholder="Enter category name"
                        maxLength={100}
                        required
                      />
                    </label>
                    {categoryType === "VARIABLE_NON_RECURRING" && (
                      <label>
                        Budget (optional)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={categoryBudget}
                          onChange={(event) =>
                            setCategoryBudget(event.target.value)
                          }
                          placeholder="Leave blank for no budget"
                        />
                      </label>
                    )}
                    {categoryType === "FIXED_RECURRING" && (
                      <label>
                        Expected bill amount
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={categoryExpectedAmount}
                          onChange={(event) =>
                            setCategoryExpectedAmount(event.target.value)
                          }
                          placeholder="120.00"
                          required
                        />
                      </label>
                    )}
                    {categoryType === "VARIABLE_RECURRING" && (
                      <p className="form-note">
                        You will enter the actual amount when recording a bill.
                      </p>
                    )}
                    <button type="submit" disabled={saving !== ""}>
                      {saving === "category" ? "Adding..." : "Add category"}
                    </button>
                  </>
                )}
              </form>
            )}

            {activeDialog === "expense" &&
              (selectedPaycheck === undefined ? (
                <p className="empty-state">
                  Add a paycheck before recording expenses.
                </p>
              ) : regularCategories.length === 0 ? (
                <p className="empty-state">
                  Create a variable non-recurring category first.
                </p>
              ) : (
                <form onSubmit={handleAddExpense}>
                  <p className="form-note">
                    This expense will be added to the selected pay period
                    ending {selectedPaycheck.period_end}.
                  </p>
                  <label>
                    Expense category
                    <select
                      value={effectiveExpenseCategoryId}
                      onChange={(event) =>
                        setExpenseCategoryId(event.target.value)
                      }
                      required
                    >
                      {regularCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Expense name
                    <input
                      type="text"
                      value={expenseName}
                      onChange={(event) => setExpenseName(event.target.value)}
                      placeholder="Weekly groceries"
                      maxLength={150}
                      required
                    />
                  </label>
                  <label>
                    Amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={expenseAmount}
                      onChange={(event) =>
                        setExpenseAmount(event.target.value)
                      }
                      placeholder="75.50"
                      required
                    />
                  </label>
                  <label>
                    Date of purchase
                    <input
                      type="date"
                      value={spentOn}
                      onChange={(event) => setSpentOn(event.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" disabled={saving !== ""}>
                    {saving === "expense" ? "Adding..." : "Add expense"}
                  </button>
                </form>
              ))}

            {activeDialog === "bill" &&
              (recurringCategories.length === 0 ? (
                <p className="empty-state">
                  Create a fixed or variable recurring category first.
                </p>
              ) : (
                <form onSubmit={handleAddRecurringBill}>
                  <p className="form-note">
                    Bill allocations are created automatically when paychecks
                    are added.
                  </p>
                  <label>
                    Recurring category
                    <select
                      value={effectiveBillingCategoryId}
                      onChange={(event) => {
                        const nextCategory = recurringCategories.find(
                          (category) => category.id === event.target.value,
                        );
                        setBillingCategoryId(event.target.value);
                        setBillingTotalAmount(
                          nextCategory?.type === "FIXED_RECURRING"
                            ? nextCategory.expected_amount ?? ""
                            : "",
                        );
                      }}
                      required
                    >
                      {recurringCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Actual bill amount
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={billingTotalAmount}
                      onChange={(event) =>
                        setBillingTotalAmount(event.target.value)
                      }
                      placeholder="Enter bill amount"
                      required
                    />
                  </label>
                  <button type="submit" disabled={saving !== ""}>
                    {saving === "billing" ? "Recording..." : "Add bill"}
                  </button>
                </form>
              ))}
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
