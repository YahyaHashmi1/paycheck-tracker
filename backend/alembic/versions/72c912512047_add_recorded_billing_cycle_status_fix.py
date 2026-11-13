"""add RECORDED billing cycle status fix

Revision ID: 72c912512047
Revises: 9a63a22e74a3
Create Date: 2026-11-12 21:38:50.085199

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72c912512047'
down_revision: Union[str, Sequence[str], None] = '9a63a22e74a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
    "ALTER TYPE billing_cycle_status ADD VALUE IF NOT EXISTS 'RECORDED'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    pass
