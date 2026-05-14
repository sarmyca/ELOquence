"""Lower starting ELO from 1000 to 800.

Revision ID: 013
Revises: 012
"""
from alembic import op
import sqlalchemy as sa


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "elo_rating", server_default="800.0")


def downgrade() -> None:
    op.alter_column("users", "elo_rating", server_default="1000.0")
