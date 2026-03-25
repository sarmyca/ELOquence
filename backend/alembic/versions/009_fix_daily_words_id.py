"""Fix daily_words.id from UUID to auto-increment integer.

The model defines id as Integer with autoincrement, but migration 001
created it as UUID. This drops and recreates the table since it only
holds ephemeral daily word picks.

Revision ID: 009
Revises: 008
Create Date: 2026-03-25
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_daily_words_date", table_name="daily_words")
    op.drop_table("daily_words")
    op.create_table(
        "daily_words",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("word", sa.String(5), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("difficulty", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date"),
    )
    op.create_index("ix_daily_words_date", "daily_words", ["date"])


def downgrade() -> None:
    op.drop_index("ix_daily_words_date", table_name="daily_words")
    op.drop_table("daily_words")
    op.create_table(
        "daily_words",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("word", sa.String(5), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("difficulty", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date"),
    )
    op.create_index("ix_daily_words_date", "daily_words", ["date"])
