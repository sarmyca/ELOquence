"""Add Google OAuth support.

- Add google_id column to users table
- Make password_hash nullable for Google-only users

Revision ID: 007
Revises: 006
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=False)
    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")
