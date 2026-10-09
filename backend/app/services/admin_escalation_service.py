import json

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ticket_access_service import (
    load_ticket_actor,
)


ASSIGNABLE_ROLES = {
    "DEPARTMENT_STAFF",
    "INSTRUCTOR",
}


def get_admin_escalation_options(
    current_user: dict[str, Any],
) -> dict[str, Any]:
    try:
        with SessionLocal() as db:
            load_ticket_actor(
                db,
                current_user,
                "ADMIN",
            )

            rows = db.execute(
                text(
                    """
                    SELECT
                        u.user_id::text
                            AS user_id,

                        u.full_name,
                        u.email,
                        u.role,

                        u.department_id::text
                            AS department_id,

                        department.department_name,

                        u.desk_id::text
                            AS desk_id,

                        desk.desk_name

                    FROM public.users u

                    JOIN public.departments department
                      ON department.department_id =
                         u.department_id

                    LEFT JOIN public.accounts_desks desk
                      ON desk.desk_id =
                         u.desk_id

                    WHERE u.role IN (
                              'DEPARTMENT_STAFF',
                              'INSTRUCTOR'
                          )

                      AND u.is_active = TRUE

                      AND COALESCE(
                              u.is_available,
                              TRUE
                          ) = TRUE

                      AND department.is_active = TRUE

                    ORDER BY
                        department.department_name,
                        u.role,
                        u.full_name,
                        u.user_id
                    """
                )
            ).mappings().all()

            return {
                "officers": [
                    dict(row)
                    for row in rows
                ],
            }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Admin escalation options are "
                "temporarily unavailable."
            ),
        ) from exc


def get_admin_escalation_review(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    try:
        with SessionLocal() as db:
            load_ticket_actor(
                db,
                current_user,
                "ADMIN",
            )

            row = db.execute(
                text(
                    """
                    SELECT
                        t.ticket_id::text
                            AS ticket_id,

                        t.ticket_number,
                        t.subject,
                        t.status,
                        t.priority,
                        t.source,

                        t.assigned_officer_id::text
                            AS assigned_officer_id,

                        officer.full_name
                            AS assigned_officer_name,

                        current_assignment.department_id::text
                            AS department_id,

                        department.department_name,

                        current_assignment.desk_id::text
                            AS desk_id,

                        desk.desk_name,

                        escalation.escalation_id::text
                            AS escalation_id,

                        escalation.reason
                            AS escalation_reason,

                        escalation.escalation_status,

                        escalation.escalated_at,

                        escalation.escalated_from_user_id::text
                            AS escalated_from_user_id,

                        escalated_from.full_name
                            AS escalated_from_name

                    FROM public.tickets t

                    JOIN public.escalations escalation
                      ON escalation.ticket_id =
                         t.ticket_id

                     AND escalation.target_role =
                         'ADMIN'

                     AND escalation.escalation_status
                         IN (
                             'OPEN',
                             'ACKNOWLEDGED'
                         )

                    LEFT JOIN public.query_assignments
                        current_assignment
                      ON current_assignment.ticket_id =
                         t.ticket_id

                     AND current_assignment.is_current =
                         TRUE

                    LEFT JOIN public.users officer
                      ON officer.user_id =
                         t.assigned_officer_id

                    LEFT JOIN public.departments department
                      ON department.department_id =
                         current_assignment.department_id

                    LEFT JOIN public.accounts_desks desk
                      ON desk.desk_id =
                         current_assignment.desk_id

                    LEFT JOIN public.users escalated_from
                      ON escalated_from.user_id =
                         escalation.escalated_from_user_id

                    WHERE t.ticket_number =
                          :ticket_number

                    ORDER BY
                        escalation.escalated_at DESC,
                        escalation.escalation_id DESC

                    LIMIT 1
                    """
                ),
                {
                    "ticket_number":
                        ticket_number,
                },
            ).mappings().first()

            if row is None:
                raise HTTPException(
                    404,
                    (
                        "No active Admin escalation "
                        "exists for this query."
                    ),
                )

            return dict(row)

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Admin escalation review is "
                "temporarily unavailable."
            ),
        ) from exc


def perform_admin_escalation_action(
    ticket_number: str,
    action: str,
    current_user: dict[str, Any],
    *,
    new_officer_id: str | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    normalized_action = (
        str(action)
        .strip()
        .upper()
    )

    if normalized_action not in {
        "REASSIGN",
        "OVERRIDE",
    }:
        raise HTTPException(
            422,
            "Invalid Admin escalation action.",
        )

    cleaned_reason = (
        reason.strip()
        if isinstance(reason, str)
        else ""
    )

    if len(cleaned_reason) < 5:
        raise HTTPException(
            422,
            (
                "Decision reason must be at "
                "least 5 characters."
            ),
        )

    if len(cleaned_reason) > 500:
        raise HTTPException(
            422,
            (
                "Decision reason cannot exceed "
                "500 characters."
            ),
        )

    try:
        with SessionLocal.begin() as db:
            actor = load_ticket_actor(
                db,
                current_user,
                "ADMIN",
            )

            ticket = db.execute(
                text(
                    """
                    SELECT
                        t.ticket_id::text
                            AS ticket_id,

                        t.ticket_number,
                        t.subject,
                        t.status,

                        t.assigned_officer_id::text
                            AS assigned_officer_id,

                        current_assignment.department_id::text
                            AS department_id,

                        current_assignment.desk_id::text
                            AS desk_id,

                        escalation.escalation_id::text
                            AS escalation_id,

                        escalation.reason
                            AS escalation_reason,

                        escalation.escalation_status

                    FROM public.tickets t

                    JOIN public.escalations escalation
                      ON escalation.ticket_id =
                         t.ticket_id

                     AND escalation.target_role =
                         'ADMIN'

                     AND escalation.escalation_status
                         IN (
                             'OPEN',
                             'ACKNOWLEDGED'
                         )

                    LEFT JOIN public.query_assignments
                        current_assignment
                      ON current_assignment.ticket_id =
                         t.ticket_id

                     AND current_assignment.is_current =
                         TRUE

                    WHERE t.ticket_number =
                          :ticket_number

                    ORDER BY
                        escalation.escalated_at DESC,
                        escalation.escalation_id DESC

                    LIMIT 1

                    FOR UPDATE OF t, escalation
                    """
                ),
                {
                    "ticket_number":
                        ticket_number,
                },
            ).mappings().first()

            if ticket is None:
                raise HTTPException(
                    404,
                    (
                        "No active Admin escalation "
                        "exists for this query."
                    ),
                )

            ticket = dict(ticket)

            if ticket["status"] != "ESCALATED":
                raise HTTPException(
                    409,
                    (
                        "Only an actively escalated "
                        "query can receive an Admin "
                        "escalation decision."
                    ),
                )

            event_at = db.execute(
                text(
                    "SELECT clock_timestamp()"
                )
            ).scalar_one()

            old_values = {
                "status":
                    ticket["status"],

                "assigned_officer_id":
                    ticket[
                        "assigned_officer_id"
                    ],

                "department_id":
                    ticket["department_id"],

                "desk_id":
                    ticket["desk_id"],
            }

            target = None

            if normalized_action == "REASSIGN":
                try:
                    normalized_officer_id = str(
                        UUID(
                            str(
                                new_officer_id
                            )
                        )
                    )
                except (
                    TypeError,
                    ValueError,
                ) as exc:
                    raise HTTPException(
                        422,
                        (
                            "Select a valid staff "
                            "member for reassignment."
                        ),
                    ) from exc

                target = db.execute(
                    text(
                        """
                        SELECT
                            u.user_id::text
                                AS user_id,

                            u.full_name,
                            u.email,
                            u.role,

                            u.department_id::text
                                AS department_id,

                            department.department_name,

                            u.desk_id::text
                                AS desk_id,

                            desk.desk_name

                        FROM public.users u

                        JOIN public.departments department
                          ON department.department_id =
                             u.department_id

                        LEFT JOIN public.accounts_desks desk
                          ON desk.desk_id =
                             u.desk_id

                        WHERE u.user_id =
                              CAST(
                                  :user_id
                                  AS UUID
                              )

                          AND u.role IN (
                              'DEPARTMENT_STAFF',
                              'INSTRUCTOR'
                          )

                          AND u.is_active = TRUE

                          AND COALESCE(
                                  u.is_available,
                                  TRUE
                              ) = TRUE

                          AND department.is_active = TRUE

                        LIMIT 1
                        """
                    ),
                    {
                        "user_id":
                            normalized_officer_id,
                    },
                ).mappings().first()

                if target is None:
                    raise HTTPException(
                        409,
                        (
                            "Selected staff member is "
                            "not available for "
                            "reassignment."
                        ),
                    )

                target = dict(target)

                if (
                    ticket[
                        "assigned_officer_id"
                    ]
                    == target["user_id"]
                ):
                    raise HTTPException(
                        409,
                        (
                            "This staff member is "
                            "already assigned."
                        ),
                    )

                updated = db.execute(
                    text(
                        """
                        UPDATE public.tickets
                        SET
                            status = 'ROUTED',

                            assigned_officer_id =
                                CAST(
                                    :officer_id
                                    AS UUID
                                ),

                            routed_desk_id =
                                CAST(
                                    :desk_id
                                    AS UUID
                                ),

                            updated_at =
                                :event_at

                        WHERE ticket_id =
                              CAST(
                                  :ticket_id
                                  AS UUID
                              )

                        RETURNING
                            ticket_id::text
                                AS ticket_id,

                            ticket_number,
                            status,

                            assigned_officer_id::text
                                AS assigned_officer_id,

                            routed_desk_id::text
                                AS routed_desk_id,

                            updated_at
                        """
                    ),
                    {
                        "officer_id":
                            target["user_id"],

                        "desk_id":
                            target["desk_id"],

                        "event_at":
                            event_at,

                        "ticket_id":
                            ticket["ticket_id"],
                    },
                ).mappings().first()

                if updated is None:
                    raise HTTPException(
                        409,
                        (
                            "Ticket state changed "
                            "during reassignment."
                        ),
                    )

                updated = dict(updated)

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
                        "ticket_id":
                            ticket["ticket_id"],
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

                            NULL,

                            'MANUAL',

                            :assignment_reason,

                            :event_at,

                            TRUE
                        )
                        """
                    ),
                    {
                        "ticket_id":
                            ticket["ticket_id"],

                        "department_id":
                            target[
                                "department_id"
                            ],

                        "desk_id":
                            target["desk_id"],

                        "officer_id":
                            target["user_id"],

                        "actor_id":
                            actor["user_id"],

                        "assignment_reason":
                            (
                                "Reassigned by system "
                                "administrator. "
                                + cleaned_reason
                            ),

                        "event_at":
                            event_at,
                    },
                )

                new_values = {
                    "status":
                        "ROUTED",

                    "assigned_officer_id":
                        target["user_id"],

                    "department_id":
                        target["department_id"],

                    "desk_id":
                        target["desk_id"],
                }

                change_note = (
                    "Admin reassigned query to "
                    + target["full_name"]
                    + " ("
                    + target[
                        "department_name"
                    ]
                    + "): "
                    + cleaned_reason
                )

                audit_action = (
                    "ADMIN_QUERY_REASSIGNED"
                )

                audit_details = {
                    "decision_reason":
                        cleaned_reason,

                    "target_user_id":
                        target["user_id"],

                    "target_user_name":
                        target["full_name"],

                    "target_role":
                        target["role"],

                    "target_department_id":
                        target[
                            "department_id"
                        ],

                    "target_department_name":
                        target[
                            "department_name"
                        ],

                    "target_desk_id":
                        target["desk_id"],

                    "target_desk_name":
                        target["desk_name"],

                    "admin_escalation_id":
                        ticket[
                            "escalation_id"
                        ],
                }

            else:
                if not ticket[
                    "assigned_officer_id"
                ]:
                    raise HTTPException(
                        409,
                        (
                            "This query has no current "
                            "officer. Use Reassign "
                            "instead of Override."
                        ),
                    )

                updated = db.execute(
                    text(
                        """
                        UPDATE public.tickets
                        SET
                            status = 'IN_PROGRESS',
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
                            status,

                            assigned_officer_id::text
                                AS assigned_officer_id,

                            routed_desk_id::text
                                AS routed_desk_id,

                            updated_at
                        """
                    ),
                    {
                        "event_at":
                            event_at,

                        "ticket_id":
                            ticket["ticket_id"],
                    },
                ).mappings().first()

                if updated is None:
                    raise HTTPException(
                        409,
                        (
                            "Ticket state changed "
                            "during the override."
                        ),
                    )

                updated = dict(updated)

                new_values = {
                    "status":
                        "IN_PROGRESS",

                    "assigned_officer_id":
                        ticket[
                            "assigned_officer_id"
                        ],

                    "department_id":
                        ticket["department_id"],

                    "desk_id":
                        ticket["desk_id"],
                }

                change_note = (
                    "Admin override decision: "
                    + cleaned_reason
                )

                audit_action = (
                    "ADMIN_QUERY_OVERRIDE"
                )

                audit_details = {
                    "decision_reason":
                        cleaned_reason,

                    "admin_escalation_id":
                        ticket[
                            "escalation_id"
                        ],
                }

            db.execute(
                text(
                    """
                    UPDATE public.escalations
                    SET
                        escalation_status =
                            'RESOLVED',

                        acknowledged_at =
                            COALESCE(
                                acknowledged_at,
                                :event_at
                            ),

                        resolved_at =
                            :event_at

                    WHERE escalation_id =
                          CAST(
                              :escalation_id
                              AS UUID
                          )
                    """
                ),
                {
                    "escalation_id":
                        ticket[
                            "escalation_id"
                        ],

                    "event_at":
                        event_at,
                },
            )

            db.execute(
                text(
                    """
                    INSERT INTO public.query_status_history (
                        ticket_id,
                        changed_by_user_id,
                        previous_status,
                        new_status,
                        change_note,
                        changed_at
                    )
                    VALUES (
                        CAST(
                            :ticket_id
                            AS UUID
                        ),

                        CAST(
                            :actor_id
                            AS UUID
                        ),

                        'ESCALATED',

                        :new_status,

                        :change_note,

                        :event_at
                    )
                    """
                ),
                {
                    "ticket_id":
                        ticket["ticket_id"],

                    "actor_id":
                        actor["user_id"],

                    "new_status":
                        updated["status"],

                    "change_note":
                        change_note,

                    "event_at":
                        event_at,
                },
            )

            db.execute(
                text(
                    """
                    INSERT INTO public.audit_logs (
                        actor_user_id,
                        actor_service,
                        action,
                        entity_type,
                        entity_id,
                        outcome,
                        old_values,
                        new_values,
                        details,
                        created_at
                    )
                    VALUES (
                        CAST(
                            :actor_id
                            AS UUID
                        ),

                        NULL,

                        :action,

                        'TICKET',

                        CAST(
                            :ticket_id
                            AS UUID
                        ),

                        'SUCCESS',

                        CAST(
                            :old_values
                            AS JSONB
                        ),

                        CAST(
                            :new_values
                            AS JSONB
                        ),

                        CAST(
                            :details
                            AS JSONB
                        ),

                        :event_at
                    )
                    """
                ),
                {
                    "actor_id":
                        actor["user_id"],

                    "action":
                        audit_action,

                    "ticket_id":
                        ticket["ticket_id"],

                    "old_values":
                        json.dumps(
                            old_values,
                            default=str,
                        ),

                    "new_values":
                        json.dumps(
                            new_values,
                            default=str,
                        ),

                    "details":
                        json.dumps(
                            audit_details,
                            default=str,
                        ),

                    "event_at":
                        event_at,
                },
            )

            return {
                "ticket_number":
                    updated[
                        "ticket_number"
                    ],

                "action":
                    normalized_action,

                "status":
                    updated["status"],

                "assigned_officer_id":
                    updated[
                        "assigned_officer_id"
                    ],

                "assigned_officer_name":
                    (
                        target[
                            "full_name"
                        ]
                        if target
                        else None
                    ),

                "department_name":
                    (
                        target[
                            "department_name"
                        ]
                        if target
                        else None
                    ),

                "desk_name":
                    (
                        target["desk_name"]
                        if target
                        else None
                    ),

                "admin_escalation_status":
                    "RESOLVED",
            }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            503,
            (
                "Admin escalation action could "
                "not complete. Please try again."
            ),
        ) from exc
