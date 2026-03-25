"""Allow guest games by making user_id nullable.

Revision ID: 008
Revises: 007
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("games", "user_id", existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    # Remove guest games before making column non-nullable
    op.execute("DELETE FROM games WHERE user_id IS NULL")
    op.alter_column("games", "user_id", existing_type=sa.UUID(), nullable=False)
