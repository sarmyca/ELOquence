"""Add missing columns to users table.

The User model has columns that were never migrated:
avatar_url, provider, provider_id, total_wins, total_losses,
season_elo, preferred_starting_word, accuracy_avg.
Also rename longest_streak -> max_streak to match the model.

Revision ID: 010
Revises: 009
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(512), nullable=True))
    op.add_column("users", sa.Column("provider", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("provider_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("total_wins", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("total_losses", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("season_elo", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("preferred_starting_word", sa.String(10), nullable=True))
    op.add_column("users", sa.Column("accuracy_avg", sa.Float(), nullable=True))

    # Rename longest_streak -> max_streak to match model
    op.alter_column("users", "longest_streak", new_column_name="max_streak")


def downgrade() -> None:
    op.alter_column("users", "max_streak", new_column_name="longest_streak")
    op.drop_column("users", "accuracy_avg")
    op.drop_column("users", "preferred_starting_word")
    op.drop_column("users", "season_elo")
    op.drop_column("users", "total_losses")
    op.drop_column("users", "total_wins")
    op.drop_column("users", "provider_id")
    op.drop_column("users", "provider")
    op.drop_column("users", "avatar_url")
