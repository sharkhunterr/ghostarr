"""Add scheduled deletion support.

Revision ID: 001_add_scheduled_deletion
Revises:
Create Date: 2025-01-26
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "001_add_scheduled_deletion"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add schedule_type, deletion_config to schedules; deletion_result to history."""
    # Add schedule_type column to schedules
    # Using batch mode for SQLite compatibility
    with op.batch_alter_table("schedules") as batch_op:
        batch_op.add_column(
            sa.Column(
                "schedule_type",
                sa.String(20),
                nullable=False,
                server_default="generation",
            )
        )
        batch_op.add_column(sa.Column("deletion_config", sa.JSON(), nullable=True))
        batch_op.create_index("ix_schedules_schedule_type", ["schedule_type"])
        # Make template_id nullable (already nullable in SQLite from initial create)
        # Note: SQLite doesn't truly enforce NOT NULL constraints when altered

    # Add deletion_result column to history
    with op.batch_alter_table("history") as batch_op:
        batch_op.add_column(sa.Column("deletion_result", sa.JSON(), nullable=True))
        # Make template_id and generation_config nullable
        # Note: SQLite doesn't support ALTER COLUMN, but batch mode handles this


def downgrade() -> None:
    """Remove scheduled deletion support."""
    with op.batch_alter_table("history") as batch_op:
        batch_op.drop_column("deletion_result")

    with op.batch_alter_table("schedules") as batch_op:
        batch_op.drop_index("ix_schedules_schedule_type")
        batch_op.drop_column("deletion_config")
        batch_op.drop_column("schedule_type")
