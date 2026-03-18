"""Add challenges table.

Revision ID: 005
Revises: 004
Create Date: 2026-03-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_word", sa.String(5), nullable=False),
        sa.Column("word_difficulty", sa.Float(), nullable=True),
        sa.Column("code", sa.String(12), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_challenges_creator_id", "challenges", ["creator_id"])
    op.create_index("ix_challenges_code", "challenges", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_challenges_code", table_name="challenges")
    op.drop_index("ix_challenges_creator_id", table_name="challenges")
    op.drop_table("challenges")
