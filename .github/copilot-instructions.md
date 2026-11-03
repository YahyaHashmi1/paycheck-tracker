
# Paycheck Tracker — Copilot Instructions

## Project Overview

Paycheck Tracker is a personal finance application for tracking paychecks,
expenses, recurring bills, and savings allocations.

The goal is to replace manual Notes and Excel tracking with a single
dashboard organized around biweekly pay periods.

Preserve existing application behavior and business rules when making changes.

## Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- Use the existing project dependencies and patterns.
- Do not introduce additional libraries without explaining why they are needed.

### Backend
- Python
- FastAPI
- SQLAlchemy ORM (synchronous sessions)
- PostgreSQL
- Psycopg
- Alembic for database migrations

### Infrastructure
- Docker / Docker Compose
- Terraform
- AWS (planned deployment target)

## Repository Structure

- `frontend/`: React application and API integration.
- `backend/app/`: FastAPI application.
- `backend/app/models/`: SQLAlchemy database models.
- `backend/app/schemas/`: Pydantic request and response schemas.
- `backend/app/routers/`: API endpoints.
- `backend/alembic/`: Database migrations.
- `docs/`: Project documentation and business rules.

Inspect the existing code before deciding where new functionality belongs.

## Important Business Rules

### Paychecks
- Pay periods are 14 days.
- A new paycheck establishes a new pay period.
- Expenses are associated with a paycheck.
- The dashboard displays information for the current paycheck.

### Expense Categories
There are three category types:

1. VARIABLE_NON_RECURRING
   - Examples: groceries and eating out.
   - Can have an optional budget.
   - Expenses are tracked against the associated paycheck.

2. FIXED_RECURRING
   - Examples: insurance and internet.
   - Has an expected bill amount.
   - The user confirms the actual charge.

3. VARIABLE_RECURRING
   - Example: electricity.
   - The user enters the actual bill amount.

### Recurring Billing Cycles

A recurring bill is recorded separately from paycheck allocations.

The billing cycle status progresses automatically:

- RECORDED: Bill has been entered; no paycheck allocation exists yet.
- FIRST_HALF_PAID: First paycheck allocation has been created.
- COMPLETE: Both paycheck allocations have been created.

When a new paycheck is created:
- RECORDED cycles receive a first allocation of half the bill amount.
- FIRST_HALF_PAID cycles receive the remaining amount.
- COMPLETE cycles are not allocated again.
- The two allocations must add up exactly to the original bill amount.
- The backend is responsible for creating these allocations.

Do not reintroduce manual first-half or second-half allocation actions in the frontend.

Only one unfinished billing cycle may exist per category.

### Spending Calculations
- Regular expense items are associated with a paycheck.
- Recurring bill allocations are associated with a paycheck through billing cycle payments.
- Do not count the full recurring bill as spending for each paycheck.
- Use the paycheck's actual allocation amount when calculating its spending.

## Coding Guidelines

- Read existing implementations before modifying them.
- Follow the current project architecture and naming conventions.
- Keep components and functions focused on a single responsibility.
- Avoid unnecessary refactoring when implementing a feature.
- Reuse existing API utilities, types, and components.
- Do not duplicate business logic between frontend and backend.
- The backend is the source of truth for billing-cycle state and payment allocations.
- Add explanatory comments for non-obvious logic.
- Keep TypeScript types explicit and consistent with backend response schemas.
- Handle loading, empty, success, and error states in the UI.
- Make the interface responsive and accessible.
- Never hardcode API response data in production components.

## Frontend-Specific Guidance

- Inspect `frontend/src/App.tsx`, `frontend/src/api.ts`,
  and `frontend/src/types.ts` before changing dashboard functionality.
- Use the existing `getJson`, `postJson`, and `apiRequest` helpers.
- Keep API request and response types synchronized with the backend.
- Prefer reusable components over adding more complexity to App.tsx.
- Avoid changing API contracts unless the task requires it.
- Follow the React and TypeScript versions installed in package.json.
- Follow existing event-handler typing patterns in the project.

## Backend-Specific Guidance

- Use the existing synchronous SQLAlchemy session pattern.
- Keep database operations in the appropriate router/service layer.
- Use Pydantic schemas for request and response validation.
- Create Alembic migrations for database schema changes.
- Do not modify existing migration history to make an already-applied
  migration appear different.
- Preserve transaction integrity when multiple database records
  must be created or updated together.

## Before Making Changes

1. Inspect the relevant frontend and backend files.
2. Identify the existing behavior and dependencies.
3. Explain the proposed changes before performing large refactors.
4. Avoid modifying unrelated functionality.

## Before Completing Changes

1. Run the relevant frontend build and/or type checks.
2. Run relevant backend tests.
3. Verify API request and response compatibility.
4. Summarize files changed and explain any required migrations.
5. Identify any tests or manual verification that still need to be done.

Never claim a test passed unless it was actually executed.
