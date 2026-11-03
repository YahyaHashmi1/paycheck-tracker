from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models.expense_category import ExpenseCategory
from app.schemas.expense_category import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCategoryUpdate,
)


router = APIRouter(
    prefix="/expense-categories",
    tags=["Expense Categories"],
)


@router.post(
    "/",
    response_model=ExpenseCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_expense_category(
    category_data: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
):
    """Create a new expense category."""

    # Check whether the user already has a category with this name.
    existing_category = (
        db.query(ExpenseCategory)
        .filter(
            ExpenseCategory.user_id == category_data.user_id,
            ExpenseCategory.name == category_data.name,
        )
        .first()
    )

    if existing_category:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An expense category with this name already exists.",
        )

    # Convert the validated Pydantic schema into a SQLAlchemy model.
    new_category = ExpenseCategory(
        **category_data.model_dump()
    )

    try:
        db.add(new_category)
        db.commit()
        db.refresh(new_category)

        return new_category

    except Exception:
        db.rollback()
        raise


@router.get(
    "/",
    response_model=list[ExpenseCategoryRead],
)
def get_expense_categories(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    """Retrieve all active expense categories for a user."""

    categories = (
        db.query(ExpenseCategory)
        .filter(
            ExpenseCategory.user_id == user_id,
            ExpenseCategory.active.is_(True),
        )
        .order_by(ExpenseCategory.name)
        .all()
    )

    return categories


@router.patch(
    "/{category_id}",
    response_model=ExpenseCategoryRead,
)
def update_expense_category(
    category_id: UUID,
    category_data: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing expense category."""

    # Find the category being updated.
    category = (
        db.query(ExpenseCategory)
        .filter(ExpenseCategory.id == category_id)
        .first()
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense category not found.",
        )

    # Only include fields explicitly provided in the request.
    update_data = category_data.model_dump(exclude_unset=True)

    # Check for duplicate names if the category name is changing.
    if "name" in update_data and update_data["name"] != category.name:
        existing_category = (
            db.query(ExpenseCategory)
            .filter(
                ExpenseCategory.user_id == category.user_id,
                ExpenseCategory.name == update_data["name"],
                ExpenseCategory.id != category_id,
            )
            .first()
        )

        if existing_category:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An expense category with this name already exists.",
            )

    # Build the category's resulting state before applying the update.
    # This ensures the amount rules remain valid after a partial PATCH.
    updated_values = {
        "user_id": category.user_id,
        "name": category.name,
        "budget": category.budget,
        "expected_amount": category.expected_amount,
        "type": category.type,
        "active": category.active,
    }

    updated_values.update(update_data)

    try:
        # Validate the complete updated category configuration.
        ExpenseCategoryCreate.model_validate(updated_values)

    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    # Apply the validated changes to the database model.
    for field, value in update_data.items():
        setattr(category, field, value)

    try:
        db.commit()
        db.refresh(category)

        return category

    except Exception:
        db.rollback()
        raise


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_expense_category(
    category_id: UUID,
    db: Session = Depends(get_db),
):
    """Deactivate an expense category instead of permanently deleting it."""

    # Find the category being deactivated.
    category = (
        db.query(ExpenseCategory)
        .filter(ExpenseCategory.id == category_id)
        .first()
    )

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense category not found.",
        )

    # Preserve historical expense records by marking the category inactive.
    category.active = False

    try:
        db.commit()

    except Exception:
        db.rollback()
        raise

    return None