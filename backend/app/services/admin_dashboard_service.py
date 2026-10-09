from typing import Any

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


OPEN_STATUSES = (
    "PENDING",
    "CLASSIFIED",
    "ROUTED",
    "IN_PROGRESS",
    "NEEDS_INFORMATION",
    "ESCALATED",
    "PENDING_APPROVAL",
)


def get_admin_dashboard_stats(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    del current_user

    try:
        with SessionLocal() as db:
            metrics = db.execute(
                text(
                    """
                    SELECT
                        COUNT(*) FILTER (
                            WHERE status <> 'DRAFT'
                        )::int
                            AS total_queries,

                        COUNT(*) FILTER (
                            WHERE status NOT IN (
                                'DRAFT',
                                'RESOLVED',
                                'CLOSED'
                            )
                        )::int
                            AS open_queries,

                        COUNT(*) FILTER (
                            WHERE status = 'RESOLVED'
                        )::int
                            AS resolved_queries,

                        COUNT(*) FILTER (
                            WHERE status = 'ESCALATED'
                        )::int
                            AS escalated_queries,

                        COUNT(*) FILTER (
                            WHERE status NOT IN (
                                'DRAFT',
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND sla_due_at IS NOT NULL
                            AND sla_due_at < NOW()
                        )::int
                            AS overdue_queries,

                        COUNT(*) FILTER (
                            WHERE status NOT IN (
                                'DRAFT',
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND sla_due_at IS NOT NULL
                        )::int
                            AS sla_known_queries,

                        COUNT(*) FILTER (
                            WHERE status NOT IN (
                                'DRAFT',
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND sla_due_at IS NOT NULL
                            AND sla_due_at >= NOW()
                        )::int
                            AS within_sla_queries,

                        ROUND(
                            COALESCE(
                                AVG(
                                    EXTRACT(
                                        EPOCH FROM (
                                            resolved_at
                                            -
                                            COALESCE(
                                                submitted_at,
                                                created_at
                                            )
                                        )
                                    ) / 3600
                                ) FILTER (
                                    WHERE status = 'RESOLVED'
                                      AND resolved_at IS NOT NULL
                                ),
                                0
                            )::numeric,
                            2
                        )
                            AS avg_resolution_hours,

                        (
                            SELECT
                                COUNT(*)::int
                            FROM public.users
                            WHERE is_active = TRUE
                        )
                            AS active_users,

                        (
                            SELECT
                                COUNT(*)::int
                            FROM public.departments
                            WHERE is_active = TRUE
                        )
                            AS active_departments,

                        (
                            SELECT
                                COUNT(*)::int
                            FROM public.departments
                        )
                            AS total_departments,

                        (
                            SELECT
                                COUNT(*)::int
                            FROM public.escalations
                            WHERE escalation_status = 'OPEN'
                        )
                            AS open_escalations

                    FROM public.tickets
                    """
                )
            ).mappings().one()

            status_rows = db.execute(
                text(
                    """
                    SELECT
                        status,
                        COUNT(*)::int AS count

                    FROM public.tickets

                    WHERE status <> 'DRAFT'

                    GROUP BY status

                    ORDER BY
                        CASE status
                            WHEN 'PENDING' THEN 1
                            WHEN 'CLASSIFIED' THEN 2
                            WHEN 'ROUTED' THEN 3
                            WHEN 'IN_PROGRESS' THEN 4
                            WHEN 'NEEDS_INFORMATION' THEN 5
                            WHEN 'ESCALATED' THEN 6
                            WHEN 'PENDING_APPROVAL' THEN 7
                            WHEN 'RESOLVED' THEN 8
                            WHEN 'CLOSED' THEN 9
                            ELSE 99
                        END,
                        status
                    """
                )
            ).mappings().all()

            department_rows = db.execute(
                text(
                    """
                    WITH ticket_scope AS (
                        SELECT
                            t.ticket_id,
                            t.status,
                            t.sla_due_at,
                            t.resolved_at,
                            t.submitted_at,
                            t.created_at,
                            COALESCE(
                                desk.department_id,
                                owner.department_id
                            ) AS department_id

                        FROM public.tickets t

                        LEFT JOIN public.accounts_desks desk
                          ON desk.desk_id = t.routed_desk_id

                        LEFT JOIN public.users owner
                          ON owner.user_id = t.assigned_officer_id

                        WHERE t.status <> 'DRAFT'
                    ),
                    active_departments AS (
                        SELECT
                            d.department_id,
                            d.department_name

                        FROM public.departments d

                        WHERE d.is_active = TRUE
                    ),
                    department_stats AS (
                        SELECT
                            d.department_id::text AS department_id,
                            d.department_name,

                            COUNT(ts.ticket_id)::int AS total_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                            )::int AS active_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status = 'ESCALATED'
                            )::int AS escalated_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status = 'RESOLVED'
                            )::int AS resolved_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                                AND ts.sla_due_at IS NOT NULL
                                AND ts.sla_due_at < NOW()
                            )::int AS overdue_queries,

                            ROUND(
                                COALESCE(
                                    AVG(
                                        EXTRACT(
                                            EPOCH FROM (
                                                ts.resolved_at
                                                -
                                                COALESCE(
                                                    ts.submitted_at,
                                                    ts.created_at
                                                )
                                            )
                                        ) / 3600
                                    ) FILTER (
                                        WHERE ts.status = 'RESOLVED'
                                          AND ts.resolved_at IS NOT NULL
                                    ),
                                    0
                                )::numeric,
                                2
                            ) AS avg_resolution_hours

                        FROM active_departments d

                        LEFT JOIN ticket_scope ts
                          ON ts.department_id = d.department_id

                        GROUP BY
                            d.department_id,
                            d.department_name
                    ),
                    unassigned_stats AS (
                        SELECT
                            NULL::text AS department_id,
                            'Unassigned / Unknown'::text AS department_name,

                            COUNT(ts.ticket_id)::int AS total_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                            )::int AS active_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status = 'ESCALATED'
                            )::int AS escalated_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status = 'RESOLVED'
                            )::int AS resolved_queries,

                            COUNT(ts.ticket_id) FILTER (
                                WHERE ts.status NOT IN (
                                    'RESOLVED',
                                    'CLOSED'
                                )
                                AND ts.sla_due_at IS NOT NULL
                                AND ts.sla_due_at < NOW()
                            )::int AS overdue_queries,

                            ROUND(
                                COALESCE(
                                    AVG(
                                        EXTRACT(
                                            EPOCH FROM (
                                                ts.resolved_at
                                                -
                                                COALESCE(
                                                    ts.submitted_at,
                                                    ts.created_at
                                                )
                                            )
                                        ) / 3600
                                    ) FILTER (
                                        WHERE ts.status = 'RESOLVED'
                                          AND ts.resolved_at IS NOT NULL
                                    ),
                                    0
                                )::numeric,
                                2
                            ) AS avg_resolution_hours

                        FROM ticket_scope ts

                        WHERE ts.department_id IS NULL
                    )

                    SELECT *
                    FROM department_stats

                    UNION ALL

                    SELECT *
                    FROM unassigned_stats
                    WHERE total_queries > 0

                    ORDER BY
                        active_queries DESC,
                        department_name
                    """
                )
            ).mappings().all()

            escalation_rows = db.execute(
                text(
                    """
                    SELECT
                        e.escalation_id::text
                            AS escalation_id,

                        e.ticket_id::text
                            AS ticket_id,

                        t.ticket_number,
                        t.subject,
                        t.priority,
                        t.status
                            AS ticket_status,

                        d.department_name,

                        e.target_role,
                        e.escalation_type,
                        e.escalation_status,

                        target_user.full_name
                            AS escalated_to_name,

                        target_user.email
                            AS escalated_to_email,

                        e.reason,
                        e.escalated_at,

                        ROUND(
                            (
                                EXTRACT(
                                    EPOCH FROM (
                                        NOW()
                                        -
                                        e.escalated_at
                                    )
                                ) / 3600
                            )::numeric,
                            2
                        )
                            AS hours_open

                    FROM public.escalations e

                    JOIN public.tickets t
                      ON t.ticket_id = e.ticket_id

                    LEFT JOIN public.departments d
                      ON d.department_id = e.department_id

                    JOIN public.users target_user
                      ON target_user.user_id = e.escalated_to_user_id

                    WHERE e.escalation_status = 'OPEN'

                    ORDER BY
                        e.escalated_at DESC,
                        e.escalation_id DESC
                    """
                )
            ).mappings().all()

            metric_data = dict(metrics)

            total_queries = int(
                metric_data["total_queries"] or 0
            )

            resolved_queries = int(
                metric_data["resolved_queries"] or 0
            )

            sla_known_queries = int(
                metric_data["sla_known_queries"] or 0
            )

            within_sla_queries = int(
                metric_data["within_sla_queries"] or 0
            )

            metric_data["resolution_rate"] = (
                round(
                    (
                        resolved_queries
                        / total_queries
                    ) * 100,
                    2,
                )
                if total_queries > 0
                else 0.0
            )

            metric_data["sla_compliance_percent"] = (
                round(
                    (
                        within_sla_queries
                        / sla_known_queries
                    ) * 100,
                    2,
                )
                if sla_known_queries > 0
                else None
            )

            return {
                "metrics": metric_data,

                "status_counts": [
                    dict(row)
                    for row in status_rows
                ],

                "department_stats": [
                    dict(row)
                    for row in department_rows
                ],

                "open_escalations": [
                    dict(row)
                    for row in escalation_rows
                ],
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Admin analytics are "
                "temporarily unavailable."
            ),
        ) from exc
