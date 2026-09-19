from collections import Counter
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ticket_access_service import (
    TICKET_FROM,
    actor_parameters,
    load_ticket_actor,
    lock_accessible_ticket,
    record_ticket_change,
)


OPEN_STATUSES = {
    "PENDING",
    "CLASSIFIED",
    "ROUTED",
    "IN_PROGRESS",
    "NEEDS_INFORMATION",
    "ESCALATED",
}


ASSIGNABLE_STAFF_ROLES = {
    "DEPARTMENT_STAFF",
    "INSTRUCTOR",
}


def _target_officer(
    db,
    officer_id,
    ticket,
):
    try:
        officer_id = str(
            UUID(str(officer_id))
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            422,
            "A valid officer ID is required.",
        ) from exc

    target_role = ticket.get(
        "target_role"
    )

    if target_role not in ASSIGNABLE_STAFF_ROLES:
        raise HTTPException(
            409,
            (
                "This routing destination cannot "
                "be assigned through the staff "
                "workflow."
            ),
        )

    row = db.execute(
        text(
            """
            SELECT
                user_id::text AS user_id,
                email
            FROM public.users
            WHERE user_id =
                  CAST(:user_id AS UUID)
            """
        ),
        {
            "user_id": officer_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            409,
            (
                "Selected user is not "
                "available for this route."
            ),
        )

    try:
        officer = load_ticket_actor(
            db,
            dict(row),
            target_role,
        )

    except HTTPException as exc:
        raise HTTPException(
            409,
            (
                "Selected user is not "
                "available for this route."
            ),
        ) from exc

    if not officer["is_available"]:
        raise HTTPException(
            409,
            "Selected user is currently unavailable.",
        )

    if (
        officer["department_id"]
        != ticket["ticket_department_id"]
    ):
        raise HTTPException(
            409,
            (
                "Selected user must belong "
                "to the same department."
            ),
        )

    ticket_desk_id = (
        str(ticket["routed_desk_id"])
        if ticket["routed_desk_id"]
        else None
    )

    if ticket_desk_id is not None:
        if officer["desk_id"] != ticket_desk_id:
            raise HTTPException(
                409,
                (
                    "Selected officer must belong "
                    "to the routed desk."
                ),
            )

    elif officer["desk_id"] is not None:
        raise HTTPException(
            409,
            (
                "Department-level routes require "
                "a user without an Accounts desk."
            ),
        )

    return officer


def _apply_action(
    ticket_number,
    current_user,
    action,
    roles,
    new_officer_id=None,
):
    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                *roles,
            )

            ticket = lock_accessible_ticket(
                db,
                ticket_number,
                actor,
            )

            old_status = ticket["status"]

            assignee = ticket[
                "assigned_officer_id"
            ]

            selected_officer = None

            if action == "START":
                if old_status != "ROUTED":
                    raise HTTPException(
                        409,
                        (
                            "Only routed tickets "
                            "can be started."
                        ),
                    )

                new_status = "IN_PROGRESS"

            elif action in {
                "RESOLVE",
                "APPROVE",
            }:
                if old_status not in {
                    "IN_PROGRESS",
                    "ESCALATED",
                }:
                    raise HTTPException(
                        409,
                        (
                            "This ticket is not "
                            "ready for resolution."
                        ),
                    )

                proof = db.execute(
                    text(
                        """
                        SELECT r.response_id
                        FROM public.responses r

                        JOIN public.users student
                          ON student.user_id =
                             CAST(:student_id AS UUID)

                         AND student.email =
                             r.recipient_email

                        WHERE r.ticket_id =
                              CAST(:ticket_id AS UUID)

                          AND r.response_type =
                              'FINAL'

                          AND r.approval_status =
                              'APPROVED'

                          AND r.delivery_status =
                              'SENT'

                          AND r.sent_at >=
                              :submitted_at

                        LIMIT 1
                        FOR SHARE OF r
                        """
                    ),
                    {
                        "ticket_id": str(
                            ticket["ticket_id"]
                        ),
                        "student_id": str(
                            ticket["student_id"]
                        ),
                        "submitted_at": (
                            ticket["submitted_at"]
                            or ticket["created_at"]
                        ),
                    },
                ).first()

                if proof is None:
                    raise HTTPException(
                        409,
                        (
                            "An approved FINAL "
                            "response must be sent "
                            "before this ticket can "
                            "be resolved."
                        ),
                    )

                new_status = "RESOLVED"

            elif action == "REJECT":
                if (
                    old_status != "ESCALATED"
                    or assignee is None
                ):
                    raise HTTPException(
                        409,
                        (
                            "Only an assigned "
                            "escalated ticket can "
                            "be returned for "
                            "further work."
                        ),
                    )

                _target_officer(
                    db,
                    assignee,
                    ticket,
                )

                new_status = "IN_PROGRESS"

            elif action == "REASSIGN":
                if old_status not in OPEN_STATUSES:
                    raise HTTPException(
                        409,
                        (
                            "Only an open ticket "
                            "can be reassigned."
                        ),
                    )

                if old_status in {
                    "PENDING",
                    "CLASSIFIED",
                }:
                    raise HTTPException(
                        409,
                        (
                            "Ticket processing must "
                            "finish before "
                            "reassignment."
                        ),
                    )

                selected_officer = (
                    _target_officer(
                        db,
                        new_officer_id,
                        ticket,
                    )
                )

                if (
                    assignee is not None
                    and
                    selected_officer["user_id"]
                    == str(assignee)
                ):
                    raise HTTPException(
                        409,
                        (
                            "This user is already "
                            "assigned."
                        ),
                    )

                assignee = selected_officer[
                    "user_id"
                ]

                new_status = (
                    "NEEDS_INFORMATION"
                    if old_status
                    == "NEEDS_INFORMATION"
                    else "ROUTED"
                )

            else:
                raise HTTPException(
                    422,
                    "Invalid ticket action.",
                )

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            row = db.execute(
                text(
                    """
                    UPDATE public.tickets
                    SET
                        status = :new_status,

                        assigned_officer_id =
                            CAST(
                                :officer_id
                                AS UUID
                            ),

                        resolved_at =
                            CASE
                                WHEN :is_resolved
                                    THEN :event_at
                                ELSE resolved_at
                            END,

                        updated_at = :event_at

                    WHERE ticket_id =
                          CAST(
                              :ticket_id
                              AS UUID
                          )

                    RETURNING
                        ticket_id::text
                            AS ticket_id,

                        ticket_number,
                        subject,
                        category,
                        priority,
                        confidence,
                        status,

                        assigned_officer_id::text
                            AS assigned_officer_id,

                        routed_desk_id::text
                            AS routed_desk_id,

                        resolved_at,
                        updated_at
                    """
                ),
                {
                    "new_status": new_status,
                    "is_resolved": (
                        new_status == "RESOLVED"
                    ),
                    "officer_id": (
                        str(assignee)
                        if assignee
                        else None
                    ),
                    "event_at": event_at,
                    "ticket_id": str(
                        ticket["ticket_id"]
                    ),
                },
            ).mappings().first()

            if row is None:
                raise HTTPException(
                    409,
                    (
                        "Ticket state changed "
                        "during the action."
                    ),
                )

            updated = dict(row)

            if selected_officer:
                db.execute(
                    text(
                        """
                        UPDATE public.query_assignments
                        SET is_current = FALSE
                        WHERE ticket_id =
                              CAST(
                                  :ticket_id
                                  AS UUID
                              )
                          AND is_current = TRUE
                        """
                    ),
                    {
                        "ticket_id": updated[
                            "ticket_id"
                        ],
                    },
                )

                db.execute(
                    text(
                        """
                        INSERT INTO public.query_assignments (
                            ticket_id,
                            department_id,
                            desk_id,
                            assigned_user_id,
                            assigned_by_user_id,
                            rule_id,
                            assignment_method,
                            assignment_reason,
                            assigned_at,
                            is_current
                        )
                        VALUES (
                            CAST(
                                :ticket_id
                                AS UUID
                            ),
                            CAST(
                                :department_id
                                AS UUID
                            ),
                            CAST(
                                :desk_id
                                AS UUID
                            ),
                            CAST(
                                :officer_id
                                AS UUID
                            ),
                            CAST(
                                :actor_id
                                AS UUID
                            ),
                            CAST(
                                :rule_id
                                AS UUID
                            ),
                            'MANUAL',
                            :assignment_reason,
                            :event_at,
                            TRUE
                        )
                        """
                    ),
                    {
                        "ticket_id": updated[
                            "ticket_id"
                        ],
                        "department_id": ticket[
                            "ticket_department_id"
                        ],
                        "desk_id": updated[
                            "routed_desk_id"
                        ],
                        "officer_id": updated[
                            "assigned_officer_id"
                        ],
                        "actor_id": actor[
                            "user_id"
                        ],
                        "rule_id": ticket.get(
                            "routing_rule_id"
                        ),
                        "assignment_reason": (
                            "Reassigned by "
                            "department HOD."
                        ),
                        "event_at": event_at,
                    },
                )

            if new_status == "RESOLVED":
                db.execute(
                    text(
                        """
                        UPDATE public.escalations
                        SET
                            escalation_status =
                                'RESOLVED',

                            resolved_at =
                                :event_at

                        WHERE ticket_id =
                              CAST(
                                  :ticket_id
                                  AS UUID
                              )

                          AND escalation_status
                              IN (
                                  'OPEN',
                                  'ACKNOWLEDGED'
                              )
                        """
                    ),
                    {
                        "ticket_id": updated[
                            "ticket_id"
                        ],
                        "event_at": event_at,
                    },
                )

            elif action in {
                "REJECT",
                "REASSIGN",
            }:
                db.execute(
                    text(
                        """
                        UPDATE public.escalations
                        SET
                            escalation_status =
                                'ACKNOWLEDGED',

                            acknowledged_at =
                                :event_at

                        WHERE ticket_id =
                              CAST(
                                  :ticket_id
                                  AS UUID
                              )

                          AND target_role = 'HOD'

                          AND escalation_status =
                              'OPEN'
                        """
                    ),
                    {
                        "ticket_id": updated[
                            "ticket_id"
                        ],
                        "event_at": event_at,
                    },
                )

            record_ticket_change(
                db,
                actor["user_id"],
                ticket,
                updated,
                "TICKET_" + action,
                (
                    "Ticket action: "
                    + action
                    + "."
                ),
                event_at,
            )

        return updated

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Ticket update could not "
                "complete. Please try again."
            ),
        ) from exc


def start_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    return _apply_action(
        ticket_number,
        current_user,
        "START",
        (
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
        ),
    )


def resolve_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    return _apply_action(
        ticket_number,
        current_user,
        "RESOLVE",
        (
            "DEPARTMENT_STAFF",
            "INSTRUCTOR",
        ),
    )


def approve_or_reassign_ticket(
    ticket_number: str,
    action: str,
    new_officer_id: str | None,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    action = action.strip().upper()

    if action not in {
        "APPROVE",
        "REJECT",
        "REASSIGN",
    }:
        raise HTTPException(
            422,
            "Invalid HOD action.",
        )

    return _apply_action(
        ticket_number,
        current_user,
        action,
        ("HOD",),
        new_officer_id,
    )


def get_hod_dashboard_stats(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    try:
        with SessionLocal() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                "HOD",
            )

            rows = db.execute(
                text(
                    """
                    SELECT
                        t.ticket_number,
                        t.subject,
                        t.priority,
                        t.status,
                        t.created_at,
                        t.updated_at,
                        t.submitted_at,
                        t.sla_due_at,
                        t.resolved_at,
                        t.requires_manual_review,

                        t.assigned_officer_id::text
                            AS assigned_officer_id,

                        officer.full_name
                            AS assignee_name,

                        desk.desk_name,

                        ticket_department.department_name,

                        current_rule.target_role,

                        CASE
                            WHEN t.status IN (
                                'RESOLVED',
                                'CLOSED'
                            )
                            AND t.resolved_at
                                IS NOT NULL
                            THEN EXTRACT(
                                EPOCH FROM (
                                    t.resolved_at
                                    -
                                    COALESCE(
                                        t.submitted_at,
                                        t.created_at
                                    )
                                )
                            ) / 3600
                        END
                            AS resolution_hours,

                        (
                            t.status = 'ESCALATED'

                            OR EXISTS (
                                SELECT 1
                                FROM public.escalations e
                                WHERE e.ticket_id =
                                      t.ticket_id

                                  AND
                                    e.escalation_status
                                    IN (
                                        'OPEN',
                                        'ACKNOWLEDGED'
                                    )
                            )
                        )
                            AS has_active_escalation,

                        (
                            t.sla_due_at IS NOT NULL

                            AND t.sla_due_at <= NOW()

                            AND t.status NOT IN (
                                'RESOLVED',
                                'CLOSED'
                            )
                        )
                            AS is_overdue

                    """
                    + TICKET_FROM
                    + """
                    WHERE
                        ticket_department.department_id =
                            CAST(
                                :department_id
                                AS UUID
                            )

                      AND t.status <> 'DRAFT'

                    ORDER BY
                        t.created_at DESC,
                        t.ticket_number DESC
                    """
                ),
                actor_parameters(actor),
            ).mappings().all()

            tickets = [
                dict(row)
                for row in rows
            ]

            officers = db.execute(
                text(
                  """
                  SELECT
                      user_id::text AS user_id,
                      full_name,
                      email,
                      role,
                      is_active,
                      is_available,
                      desk_id::text AS desk_id

                  FROM public.users

                  WHERE department_id =
                      CAST(
                          :department_id
                          AS UUID
                      )

                  AND role IN (
                      'DEPARTMENT_STAFF',
                      'INSTRUCTOR'
                  )

                  AND is_active = TRUE

                  AND (
                      role <> 'INSTRUCTOR'
                      OR is_available = TRUE
                  )

                  ORDER BY
                      role,
                      full_name,
                      user_id
                  """
              ),
                actor_parameters(actor),
            ).mappings().all()

            active = [
                ticket
                for ticket in tickets
                if ticket["status"]
                in OPEN_STATUSES
            ]

            workload = Counter(
                ticket[
                    "assigned_officer_id"
                ]
                for ticket in active
                if ticket[
                    "assigned_officer_id"
                ]
            )

            samples = [
                float(
                    ticket[
                        "resolution_hours"
                    ]
                )
                for ticket in tickets
                if ticket[
                    "resolution_hours"
                ]
                is not None
            ]

            queue = [
                ticket
                for ticket in active
                if (
                    ticket[
                        "has_active_escalation"
                    ]
                    or ticket["is_overdue"]
                    or ticket[
                        "requires_manual_review"
                    ]
                    or not ticket[
                        "assigned_officer_id"
                    ]
                )
            ]

            queue.sort(
                key=lambda ticket: (
                    ticket["created_at"],
                    ticket["ticket_number"],
                )
            )

            return {
                "metrics": {
                    "total_queries": len(
                        tickets
                    ),

                    "active_queries": len(
                        active
                    ),

                    "escalated_queries": sum(
                        bool(
                            ticket[
                                "has_active_escalation"
                            ]
                        )
                        for ticket in active
                    ),

                    "avg_resolution_hours": (
                        round(
                            sum(samples)
                            / len(samples),
                            1,
                        )
                        if samples
                        else None
                    ),

                    "resolution_sample_count": len(
                        samples
                    ),
                },

                "officer_workload": [
                    {
                        **dict(officer),
                        "active_tickets": (
                            workload[
                                officer[
                                    "user_id"
                                ]
                            ]
                        ),
                    }
                    for officer in officers
                ],

                "all_tickets": tickets,

                "action_required_queue": queue,
            }

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "HOD dashboard is "
                "temporarily unavailable."
            ),
        ) from exc