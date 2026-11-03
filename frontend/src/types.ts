// Describe the data coming from FastAPI

// Matches the fields returned by the PaycheckRead schema.
export interface Paycheck {
  id: string;
  user_id: string;
  amount: string; // Decimal amounts are commonly serialized as JSON strings.
  pay_date: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

// Matches the fields returned by the ExpenseCategoryRead schema.
export interface ExpenseCategory {
  id: string;
  user_id: string;
  name: string;
  budget: string | null;
  expected_amount: string | null;
  type:
    | "VARIABLE_NON_RECURRING"
    | "FIXED_RECURRING"
    | "VARIABLE_RECURRING";
  active: boolean;
}

// Matches the fields returned by the ExpenseItemRead schema.
export interface ExpenseItem {
  id: string;
  category_id: string;
  paycheck_id: string;
  name: string;
  amount: string;
  spent_on: string;
  created_at: string;
}


 // Data sent to POST /paychecks.
export interface PaycheckCreate {
  user_id: string;
  amount: string;
  pay_date: string;
}

// Data sent to POST /expense-categories.
export interface ExpenseCategoryCreate {
  user_id: string;
  name: string;
  budget: string | null;
  expected_amount: string | null;
  type:
    | "VARIABLE_NON_RECURRING"
    | "FIXED_RECURRING"
    | "VARIABLE_RECURRING";
  active: boolean;
}

// Data sent to POST /expense-items.
export interface ExpenseItemCreate {
  category_id: string;
  paycheck_id: string;
  name: string;
  amount: string;
  spent_on: string;
}

// Represents a recurring bill split across two paychecks.
export interface BillingCycle {
  id: string;
  category_id: string;
  total_amount: string;
  status: "RECORDED" |"FIRST_HALF_PAID" | "COMPLETE";
  created_at: string;
  completed_at: string | null;
}

// Represents the portion of a recurring bill allocated to a paycheck.
export interface BillingCyclePayment {
  id: string;
  billing_cycle_id: string;
  paycheck_id: string;
  amount: string;
  created_at: string;
}

// Data required to create a recurring bill cycle.
export interface BillingCycleCreate {
  category_id: string;
  total_amount: string;
}
