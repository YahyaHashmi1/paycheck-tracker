
import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";

import { getJson, postJson } from "./api";
import type {
  Paycheck,
  PaycheckCreate,
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseItem,
  ExpenseItemCreate,
  BillingCycle,
  BillingCyclePayment,
  BillingCycleCreate,
} from "./types";

import "./App.css";

// Read the development user ID from the Vite environment.
const USER_ID = import.meta.env.VITE_DEMO_USER_ID;

// Infer React's form-submit event type from its form component props.
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<"form">["onSubmit"]>
>[0];

// Category types supported by the application.
type CategoryType = ExpenseCategory["type"];

// Return today's date in local YYYY-MM-DD format.
function getToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Format API monetary values as US currency.
function formatCurrency(
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

// Display readable category type names.
function formatCategoryType(type: CategoryType): string {
  const labels: Record<CategoryType, string> = {
    VARIABLE_NON_RECURRING: "Variable non-recurring",
    FIXED_RECURRING: "Fixed recurring",
    VARIABLE_RECURRING: "Variable recurring",
  };

  return labels[type];
}

function App() {
  // --------------------------------------------------
  // Dashboard data
  // --------------------------------------------------

  const [paychecks, setPaychecks] = useState<Paycheck[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [billingCycles, setBillingCycles] = useState<BillingCycle[]>([]);
  const [billingPayments, setBillingPayments] = useState<
    BillingCyclePayment[]
  >([]);

  // --------------------------------------------------
  // General page status
  // --------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // --------------------------------------------------
  // Add paycheck form
  // --------------------------------------------------

  const [paycheckAmount, setPaycheckAmount] = useState("");
  const [payDate, setPayDate] = useState(getToday());

  // --------------------------------------------------
  // Add category form
  // --------------------------------------------------

  // An empty string means the user has not selected a category type.
  const [categoryType, setCategoryType] = useState<CategoryType | "">("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryBudget, setCategoryBudget] = useState("");
  const [categoryExpectedAmount, setCategoryExpectedAmount] = useState("");

  // --------------------------------------------------
  // Add ordinary expense form
  // --------------------------------------------------

  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [spentOn, setSpentOn] = useState(getToday());

  // --------------------------------------------------
  // Add recurring bill form
  // --------------------------------------------------

  const [billingCategoryId, setBillingCategoryId] = useState("");
  const [billingTotalAmount, setBillingTotalAmount] = useState("");

  // The latest paycheck is the active paycheck for the dashboard.
  const currentPaycheck = paychecks[0];

  // Only variable non-recurring categories accept ordinary expense items.
  const regularCategories = useMemo(
    () =>
      categories.filter(
        (category) => category.type === "VARIABLE_NON_RECURRING",
      ),
    [categories],
  );

  // Fixed and variable recurring categories are handled separately.
  const recurringCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === "FIXED_RECURRING" ||
          category.type === "VARIABLE_RECURRING",
      ),
    [categories],
  );

  // --------------------------------------------------
  // Load dashboard data
  // --------------------------------------------------

  // Retrieve paychecks and active categories for the development user.
  async function loadDashboard() {
    if (!USER_ID) {
      throw new Error(
        "Set VITE_DEMO_USER_ID in frontend/.env to your existing user UUID.",
      );
    }

    // Fetch both collections concurrently.
    const [paycheckData, categoryData] = await Promise.all([
      getJson<Paycheck[]>("/paychecks"),
      getJson<ExpenseCategory[]>(
        `/expense-categories?user_id=${encodeURIComponent(USER_ID)}`,
      ),
    ]);

    // Keep only this user's paychecks and sort newest first.
    const userPaychecks = paycheckData
      .filter((paycheck) => paycheck.user_id === USER_ID)
      .sort((a, b) => b.pay_date.localeCompare(a.pay_date));

    // Hide categories that have been deactivated.
    const activeCategories = categoryData.filter(
      (category) => category.active,
    );

    setPaychecks(userPaychecks);
    setCategories(activeCategories);
  }

  // Retrieve recurring billing cycles and their payment allocations.
  async function loadBillingData() {
    if (!USER_ID) return;

    // Fetch all recurring billing cycles for this user.
    const cycles = await getJson<BillingCycle[]>(
      `/billing-cycles?user_id=${encodeURIComponent(USER_ID)}`,
    );

    setBillingCycles(cycles);

    // Fetch payment allocations for each billing cycle.
    const paymentGroups = await Promise.all(
      cycles.map((cycle) =>
        getJson<BillingCyclePayment[]>(
          `/billing-cycle-payments?billing_cycle_id=${encodeURIComponent(
            cycle.id,
          )}`,
        ),
      ),
    );

    // Combine the individual payment arrays.
    setBillingPayments(paymentGroups.flat());
  }

  // Load the dashboard when the component first mounts.
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
  }, []);

  // --------------------------------------------------
  // Load current paycheck expenses
  // --------------------------------------------------

  // Fetch expenses whenever the active paycheck changes.
  useEffect(() => {
    let cancelled = false;

    async function loadExpenses() {
      if (!currentPaycheck) {
        setExpenses([]);
        return;
      }

      try {
        // Retrieve only expenses associated with the active paycheck.
        const data = await getJson<ExpenseItem[]>(
          `/expense-items?paycheck_id=${encodeURIComponent(
            currentPaycheck.id,
          )}`,
        );

        if (!cancelled) {
          setExpenses(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load expenses.",
          );
        }
      }
    }

    void loadExpenses();

    // Prevent stale responses from updating the dashboard.
    return () => {
      cancelled = true;
    };
  }, [currentPaycheck?.id]);

  // --------------------------------------------------
  // Keep form selections valid
  // --------------------------------------------------

  // Select the first ordinary expense category when available.
  useEffect(() => {
    if (regularCategories.length === 0) {
      setExpenseCategoryId("");
      return;
    }

    const selectionIsValid = regularCategories.some(
      (category) => category.id === expenseCategoryId,
    );

    if (!selectionIsValid) {
      setExpenseCategoryId(regularCategories[0].id);
    }
  }, [regularCategories, expenseCategoryId]);

  // Select the first recurring category when available.
  useEffect(() => {
    if (recurringCategories.length === 0) {
      setBillingCategoryId("");
      return;
    }

    const selectionIsValid = recurringCategories.some(
      (category) => category.id === billingCategoryId,
    );

    if (!selectionIsValid) {
      setBillingCategoryId(recurringCategories[0].id);
    }
  }, [recurringCategories, billingCategoryId]);

  // Prefill the expected amount when a fixed recurring category is selected.
  useEffect(() => {
    const selectedCategory = recurringCategories.find(
      (category) => category.id === billingCategoryId,
    );

    if (selectedCategory?.type === "FIXED_RECURRING") {
      setBillingTotalAmount(selectedCategory.expected_amount ?? "");
    } else {
      // Variable recurring bills require the actual amount to be entered.
      setBillingTotalAmount("");
    }
  }, [billingCategoryId, recurringCategories]);

  // Reload recurring billing data when the current paycheck changes.
  useEffect(() => {
    void loadBillingData().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recurring bills.",
      );
    });
  }, [currentPaycheck?.id]);

  // --------------------------------------------------
  // Category spending calculations
  // --------------------------------------------------

  // Calculate ordinary and recurring spending for each category.
  const categorySpending = useMemo(() => {
    return categories.map((category) => {
      // Sum ordinary expenses for this category and paycheck.
      const regularSpending = expenses
        .filter((expense) => expense.category_id === category.id)
        .reduce(
          (total, expense) => total + Number(expense.amount),
          0,
        );

      // Sum recurring bill allocations for this category and paycheck.
      const recurringSpending = billingCycles
        .filter((cycle) => cycle.category_id === category.id)
        .reduce((total, cycle) => {
          const cyclePaymentTotal = billingPayments
            .filter(
              (payment) =>
                payment.billing_cycle_id === cycle.id &&
                payment.paycheck_id === currentPaycheck?.id,
            )
            .reduce(
              (sum, payment) => sum + Number(payment.amount),
              0,
            );

          return total + cyclePaymentTotal;
        }, 0);

      // Combine ordinary expenses and recurring allocations.
      const spent = regularSpending + recurringSpending;

      // Calculate remaining budget only when a budget exists.
      const remaining =
        category.budget === null
          ? null
          : Number(category.budget) - spent;

      return {
        category,
        spent,
        remaining,
      };
    });
  }, [categories, expenses, billingCycles, billingPayments, currentPaycheck?.id]);

  // --------------------------------------------------
  // Add paycheck
  // --------------------------------------------------

  async function handleAddPaycheck(event: FormSubmitEvent) {
    event.preventDefault();
    setSaving("paycheck");
    setError("");
    setMessage("");

    try {
      if (!USER_ID) {
        throw new Error("Configure VITE_DEMO_USER_ID in frontend/.env.");
      }

      // Send the new paycheck to the backend.
      const data: PaycheckCreate = {
        user_id: USER_ID,
        amount: paycheckAmount,
        pay_date: payDate,
      };

      await postJson<Paycheck, PaycheckCreate>("/paychecks", data);

      // Refresh paychecks so the new one becomes the active paycheck.
      await loadDashboard();

      // Refresh billing cycles and allocations created by the backend
      // when this paycheck was added.
      await loadBillingData();

      // Clear the form after successful creation.
      setPaycheckAmount("");
      setPayDate(getToday());
      setMessage("Paycheck added successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add paycheck.",
      );
    } finally {
      setSaving("");
    }
  }

  // --------------------------------------------------
  // Add expense category
  // --------------------------------------------------

  async function handleAddCategory(event: FormSubmitEvent) {
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

      // Prepare category data based on the selected category type.
      const data: ExpenseCategoryCreate = {
        user_id: USER_ID,
        name: categoryName.trim(),
        type: categoryType,
        active: true,

        // Only variable non-recurring categories use a budget.
        budget:
          categoryType === "VARIABLE_NON_RECURRING" &&
          categoryBudget.trim() !== ""
            ? categoryBudget
            : null,

        // Only fixed recurring categories use an expected bill amount.
        expected_amount:
          categoryType === "FIXED_RECURRING"
            ? categoryExpectedAmount
            : null,
      };

      await postJson<ExpenseCategory, ExpenseCategoryCreate>(
        "/expense-categories",
        data,
      );

      // Refresh the category list.
      await loadDashboard();

      // Reset the category form, including its type selection.
      setCategoryType("");
      setCategoryName("");
      setCategoryBudget("");
      setCategoryExpectedAmount("");

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

  // --------------------------------------------------
  // Add ordinary expense
  // --------------------------------------------------

  async function handleAddExpense(event: FormSubmitEvent) {
    event.preventDefault();
    setSaving("expense");
    setError("");
    setMessage("");

    // Ordinary expenses must be associated with the active paycheck.
    if (!currentPaycheck) {
      setError("Add a paycheck before adding expenses.");
      setSaving("");
      return;
    }

    try {
      // Automatically associate the expense with the current paycheck.
      const data: ExpenseItemCreate = {
        category_id: expenseCategoryId,
        paycheck_id: currentPaycheck.id,
        name: expenseName.trim(),
        amount: expenseAmount,
        spent_on: spentOn,
      };

      await postJson<ExpenseItem, ExpenseItemCreate>(
        "/expense-items",
        data,
      );

      // Refresh the current paycheck's expenses.
      const updatedExpenses = await getJson<ExpenseItem[]>(
        `/expense-items?paycheck_id=${encodeURIComponent(
          currentPaycheck.id,
        )}`,
      );

      setExpenses(updatedExpenses);

      // Clear the form.
      setExpenseName("");
      setExpenseAmount("");
      setSpentOn(getToday());

      setMessage("Expense added successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to add expense.",
      );
    } finally {
      setSaving("");
    }
  }

  // --------------------------------------------------
  // Add recurring bill
  // --------------------------------------------------

  async function handleAddRecurringBill(event: FormSubmitEvent) {
    event.preventDefault();
    setSaving("billing");
    setError("");
    setMessage("");

    try {
      // Record the credit card charge without allocating it to a paycheck.
      const data: BillingCycleCreate = {
        category_id: billingCategoryId,
        total_amount: billingTotalAmount,
      };

      await postJson<BillingCycle, BillingCycleCreate>(
        "/billing-cycles",
        data,
      );

      // Refresh billing cycles and their payment allocations.
      await loadBillingData();

      setBillingTotalAmount("");
      setMessage("Recurring bill added successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to add recurring bill.",
      );
    } finally {
      setSaving("");
    }
  }

  // --------------------------------------------------
  // Loading state
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="dashboard">
        <h1>Paycheck Tracker</h1>
        <p>Loading dashboard...</p>
      </main>
    );
  }

  // --------------------------------------------------
  // Dashboard UI
  // --------------------------------------------------

  return (
    <main className="dashboard">
      <header>
        <h1>Paycheck Tracker</h1>
        <p>Track your paychecks, expenses, and recurring bills.</p>
      </header>

      {/* Display errors and successful-action messages. */}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}

      {/* Current paycheck summary. */}
      <section className="panel">
        <h2>Current Paycheck</h2>

        {currentPaycheck ? (
          <>
            <p className="summary-amount">
              {formatCurrency(currentPaycheck.amount)}
            </p>

            <p>
              Pay period: {currentPaycheck.period_start} –{" "}
              {currentPaycheck.period_end}
            </p>

            <p>Pay date: {currentPaycheck.pay_date}</p>
          </>
        ) : (
          <p>No paycheck has been added yet.</p>
        )}
      </section>

      {/* Add paycheck form. */}
      <section className="panel">
        <h2>Add Paycheck</h2>

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
            {saving === "paycheck" ? "Adding..." : "Add Paycheck"}
          </button>
        </form>
      </section>

      {/* Add expense category with fields that depend on its type. */}
      <section className="panel">
        <h2>Add Expense Category</h2>

        <form onSubmit={handleAddCategory}>
          {/* Category type must be selected before other fields appear. */}
          <label>
            Category type
            <select
              value={categoryType}
              onChange={(event) => {
                // Clear previous type-specific values when the type changes.
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
              <option value="FIXED_RECURRING">
                Fixed recurring
              </option>
              <option value="VARIABLE_RECURRING">
                Variable recurring
              </option>
            </select>
          </label>

          {/* Show the remaining fields only after a type is selected. */}
          {categoryType !== "" && (
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

              {/* Variable non-recurring categories have an optional budget. */}
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

              {/* Fixed recurring categories have a known expected amount. */}
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

              {/* Variable recurring categories need no amount at creation. */}
              {categoryType === "VARIABLE_RECURRING" && (
                <p>
                  You will enter the actual bill amount when recording the
                  recurring bill.
                </p>
              )}

              <button type="submit" disabled={saving !== ""}>
                {saving === "category" ? "Adding..." : "Add Category"}
              </button>
            </>
          )}
        </form>
      </section>

      {/* Display all active expense categories. */}
      <section className="panel">
        <h2>Expense Categories</h2>

        {categories.length === 0 ? (
          <p>No expense categories have been created yet.</p>
        ) : (
          <ul className="record-list">
            {categories.map((category) => (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <p>{formatCategoryType(category.type)}</p>
                </div>

                <div>
                  {category.type === "VARIABLE_NON_RECURRING" && (
                    <span>
                      {category.budget === null
                        ? "No budget"
                        : `Budget: ${formatCurrency(category.budget)}`}
                    </span>
                  )}

                  {category.type === "FIXED_RECURRING" && (
                    <span>
                      Expected: {formatCurrency(category.expected_amount)}
                    </span>
                  )}

                  {category.type === "VARIABLE_RECURRING" && (
                    <span>Variable bill amount</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Show spending and remaining budget for each category. */}
      <section className="panel">
        <h2>Spending by Category</h2>

        {!currentPaycheck ? (
          <p>Add a paycheck to view category spending.</p>
        ) : categorySpending.length === 0 ? (
          <p>No categories have been created yet.</p>
        ) : (
          <ul className="record-list">
            {categorySpending.map(({ category, spent, remaining }) => (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>

                  <p>Spent: {formatCurrency(spent)}</p>

                  {category.budget !== null && (
                    <>
                      <p>Budget: {formatCurrency(category.budget)}</p>

                      <p>
                        {remaining !== null && remaining >= 0
                          ? `Remaining: ${formatCurrency(remaining)}`
                          : `Over budget: ${formatCurrency(
                              Math.abs(remaining ?? 0),
                            )}`}
                      </p>
                    </>
                  )}

                  {category.budget === null && (
                    <p>
                      {category.type === "FIXED_RECURRING"
                        ? `Expected bill: ${formatCurrency(
                            category.expected_amount,
                          )}`
                        : "No budget set"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add ordinary expenses to variable non-recurring categories. */}
      <section className="panel">
        <h2>Add Expense</h2>

        {!currentPaycheck ? (
          <p>Add a paycheck first to start recording expenses.</p>
        ) : regularCategories.length === 0 ? (
          <p>
            Create a variable non-recurring category first, such as Groceries
            or Eating Out.
          </p>
        ) : (
          <form onSubmit={handleAddExpense}>
            <p>
              Adding expense to paycheck dated{" "}
              <strong>{currentPaycheck.pay_date}</strong>.
            </p>

            <label>
              Expense category
              <select
                value={expenseCategoryId}
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
                onChange={(event) => setExpenseAmount(event.target.value)}
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
              {saving === "expense" ? "Adding..." : "Add Expense"}
            </button>
          </form>
        )}
      </section>

      {/* Record a recurring credit card charge without allocating it yet. */}
      <section className="panel">
        <h2>Add Recurring Bill</h2>

        {recurringCategories.length === 0 ? (
          <p>
            Create a fixed recurring or variable recurring category first.
          </p>
        ) : (
          <form onSubmit={handleAddRecurringBill}>
            <p>
              Record the credit card charge here. It will be allocated
              automatically as you add future paychecks.
            </p>

            <label>
              Recurring category
              <select
                value={billingCategoryId}
                onChange={(event) =>
                  setBillingCategoryId(event.target.value)
                }
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
              {saving === "billing" ? "Adding..." : "Add Recurring Bill"}
            </button>
          </form>
        )}
      </section>

      {/* Display recurring bill cycles and their allocation status. */}
      <section className="panel">
        <h2>Recurring Bills</h2>

        {billingCycles.length === 0 ? (
          <p>No recurring bills have been recorded yet.</p>
        ) : (
          <ul className="record-list">
            {billingCycles.map((cycle) => {
              // Find the category associated with this billing cycle.
              const category = categories.find(
                (item) => item.id === cycle.category_id,
              );

              // Calculate the amount allocated to the current paycheck.
              const currentPayment = billingPayments
                .filter(
                  (payment) =>
                    payment.billing_cycle_id === cycle.id &&
                    payment.paycheck_id === currentPaycheck?.id,
                )
                .reduce(
                  (total, payment) => total + Number(payment.amount),
                  0,
                );

              // Calculate total allocations across all paychecks.
              const totalAllocated = billingPayments
                .filter((payment) => payment.billing_cycle_id === cycle.id)
                .reduce(
                  (total, payment) => total + Number(payment.amount),
                  0,
                );

              return (
                <li key={cycle.id}>
                  <div>
                    <strong>{category?.name ?? "Unknown category"}</strong>

                    <p>Full bill: {formatCurrency(cycle.total_amount)}</p>

                    <p>
                      Current paycheck allocation:{" "}
                      {formatCurrency(currentPayment)}
                    </p>

                    <p>
                      Total allocated: {formatCurrency(totalAllocated)}
                    </p>

                    <p>
                      Status:{" "}
                      {cycle.status === "RECORDED"
                        ? "Bill Recorded"
                        : cycle.status === "FIRST_HALF_PAID"
                          ? "First Half Paid"
                          : "Complete"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Display individual ordinary expenses for the current paycheck. */}
      <section className="panel">
        <h2>Current Paycheck Expenses</h2>

        {!currentPaycheck ? (
          <p>Add a paycheck to view its expenses.</p>
        ) : expenses.length === 0 ? (
          <p>No ordinary expenses recorded for this paycheck yet.</p>
        ) : (
          <ul className="record-list">
            {expenses.map((expense) => {
              // Look up the category name for each expense.
              const category = categories.find(
                (item) => item.id === expense.category_id,
              );

              return (
                <li key={expense.id}>
                  <div>
                    <strong>{expense.name}</strong>
                    <p>
                      {category?.name ?? "Unknown category"} ·{" "}
                      {expense.spent_on}
                    </p>
                  </div>

                  <strong>{formatCurrency(expense.amount)}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;
