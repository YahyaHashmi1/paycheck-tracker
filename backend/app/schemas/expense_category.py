
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Import the existing category enum from your SQLAlchemy model.
from app.models.expense_category import CategoryType


class ExpenseCategoryCreate(BaseModel):
    # User who owns the category.
    user_id: UUID

    # Display name of the category.
    name: str = Field(min_length=1, max_length=100)

    # Optional spending limit for variable non-recurring categories.
    budget: Decimal | None = Field(default=None, ge=0)

    # Expected bill amount for fixed recurring categories.
    expected_amount: Decimal | None = Field(default=None, gt=0)

    # Category type selected by the user.
    type: CategoryType

    # Newly created categories are active by default.
    active: bool = True

    @model_validator(mode="after")
    def validate_category_amounts(self):
        # Variable non-recurring categories can have a budget,
        # but they should not have an expected recurring bill amount.
        if self.type == CategoryType.VARIABLE_NON_RECURRING:
            if self.expected_amount is not None:
                raise ValueError(
                    "Variable non-recurring categories cannot have an expected amount."
                )

        # Fixed recurring categories require an expected bill amount.
        elif self.type == CategoryType.FIXED_RECURRING:
            if self.expected_amount is None:
                raise ValueError(
                    "Fixed recurring categories require an expected amount."
                )

            if self.budget is not None:
                raise ValueError(
                    "Fixed recurring categories cannot have a budget."
                )

        # Variable recurring categories do not have either amount
        # until the actual bill is recorded.
        elif self.type == CategoryType.VARIABLE_RECURRING:
            if self.budget is not None or self.expected_amount is not None:
                raise ValueError(
                    "Variable recurring categories cannot have a budget or expected amount."
                )

        return self


class ExpenseCategoryUpdate(BaseModel):
    # All fields are optional because this schema is used for PATCH.
    name: str | None = Field(default=None, min_length=1, max_length=100)
    budget: Decimal | None = Field(default=None, ge=0)
    expected_amount: Decimal | None = Field(default=None, gt=0)
    type: CategoryType | None = None
    active: bool | None = None


class ExpenseCategoryRead(BaseModel):
    # Allow SQLAlchemy model instances to be serialized.
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    budget: Decimal | None
    expected_amount: Decimal | None
    type: CategoryType
    active: bool
