from datetime import timedelta, datetime, timezone
from uuid import UUID
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.paycheck import Paycheck
from app.schemas.paycheck import PaycheckCreate, PaycheckRead
from app.models.billing_cycle import BillingCycle, BillingCycleStatus
from app.models.billing_cycle_payment import BillingCyclePayment
from app.models.expense_category import ExpenseCategory
from app.dependencies import get_db

router = APIRouter(prefix="/paychecks", tags=["Paychecks"])

@router.post("", response_model=PaycheckRead, status_code=200)
def create_paycheck(
    paycheck_data: PaycheckCreate,
    db: Session = Depends(get_db),
):
    period_start = paycheck_data.pay_date
    period_end = period_start + timedelta(days=14)

    paycheck = Paycheck(
        user_id=paycheck_data.user_id,
        amount=paycheck_data.amount,
        pay_date=paycheck_data.pay_date,
        period_start=period_start,
        period_end=period_end,
    )

    db.add(paycheck)
    db.flush()  

    # Find unfinished recurring bills belonging to this paycheck's user.
    pending_cycles = (
        db.query(BillingCycle)
        .join(
            ExpenseCategory,
            BillingCycle.category_id == ExpenseCategory.id,
        )
        .filter(
            ExpenseCategory.user_id == paycheck.user_id,
            BillingCycle.status.in_([
                BillingCycleStatus.RECORDED,
                BillingCycleStatus.FIRST_HALF_PAID,
            ]),
        )
        .all()
    )

    # Allocate each unfinished bill to the newly created paycheck.
    for cycle in pending_cycles:

        # Get any existing paycheck allocations for this bill.
        existing_payments = (
            db.query(BillingCyclePayment)
            .filter(BillingCyclePayment.billing_cycle_id == cycle.id)
            .order_by(BillingCyclePayment.created_at.asc())
            .all()
        )

        if cycle.status == BillingCycleStatus.RECORDED:
            # This is the first paycheck added after recording the bill.
            first_amount = (
                cycle.total_amount / Decimal("2")
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Create the first-half allocation.
            new_payment = BillingCyclePayment(
                billing_cycle_id=cycle.id,
                paycheck_id=paycheck.id,
                amount=first_amount,
            )

            # Update the bill status to indicate the first half is paid.
            cycle.status = BillingCycleStatus.FIRST_HALF_PAID

            db.add(new_payment)

        elif cycle.status == BillingCycleStatus.FIRST_HALF_PAID:
            # Find the first paycheck allocation.
            if not existing_payments:
                continue

            first_payment = existing_payments[0]

            # Calculate the remaining amount to preserve the exact bill total.
            second_amount = cycle.total_amount - first_payment.amount

            # Create the second-half allocation.
            new_payment = BillingCyclePayment(
                billing_cycle_id=cycle.id,
                paycheck_id=paycheck.id,
                amount=second_amount,
            )

            # Mark the bill as fully allocated.
            cycle.status = BillingCycleStatus.COMPLETE
            cycle.completed_at = datetime.now(timezone.utc)

            db.add(new_payment)

    try:
        db.commit()
        db.refresh(paycheck)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create paycheck",
        )

    return paycheck

@router.delete("/{paycheck_id}", response_model=PaycheckRead, status_code=200)
def delete_paycheck(
    paycheck_id: UUID,
    db: Session = Depends(get_db),
):
    paycheck = db.get(Paycheck, paycheck_id)

    if paycheck is None:
        raise HTTPException(
            status_code=404,
            detail="Paycheck not found",
        )

    db.delete(paycheck)
    db.commit()
    return paycheck


@router.get("", response_model=list[PaycheckRead])
def list_paychecks(db: Session = Depends(get_db)):
    return (
        db.query(Paycheck)
        .order_by(Paycheck.pay_date.desc())
        .all()
    )


@router.get("/{paycheck_id}", response_model=PaycheckRead)
def get_paycheck(
    paycheck_id: UUID,
    db: Session = Depends(get_db),
):
    paycheck = db.get(Paycheck, paycheck_id)

    if paycheck is None:
        raise HTTPException(
            status_code=404,
            detail="Paycheck not found",
        )

    return paycheck
