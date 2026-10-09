import json

from collections import Counter

from typing import Any

from uuid import UUID, uuid4



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

    reason=None,

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

            admin_target = None

            current_hod_escalation = None

            admin_escalation_id = None



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



            elif action == "OVERRIDE":

                if (

                    old_status != "ESCALATED"

                    or assignee is None

                ):

                    raise HTTPException(

                        409,

                        (

                            "Only an assigned "

                            "escalated ticket can "

                            "be overridden."

                        ),

                    )



                _target_officer(

                    db,

                    assignee,

                    ticket,

                )



                if (

                    not isinstance(reason, str)

                    or len(reason.strip()) < 5

                ):

                    raise HTTPException(

                        422,

                        (

                            "Override reason must be "

                            "at least 5 characters."

                        ),

                    )



                if len(reason.strip()) > 500:

                    raise HTTPException(

                        422,

                        (

                            "Override reason cannot "

                            "exceed 500 characters."

                        ),

                    )



                reason = reason.strip()



                new_status = "IN_PROGRESS"



            elif action == "ESCALATE_ADMIN":

                if old_status != "ESCALATED":

                    raise HTTPException(

                        409,

                        (

                            "Only an actively "

                            "escalated ticket can "

                            "be escalated to Admin."

                        ),

                    )



                if (

                    not isinstance(reason, str)

                    or len(reason.strip()) < 5

                ):

                    raise HTTPException(

                        422,

                        (

                            "Admin escalation reason "

                            "must be at least "

                            "5 characters."

                        ),

                    )



                if len(reason.strip()) > 500:

                    raise HTTPException(

                        422,

                        (

                            "Admin escalation reason "

                            "cannot exceed "

                            "500 characters."

                        ),

                    )



                reason = reason.strip()



                current_hod_escalation = (

                    db.execute(

                        text(

                            """

                            SELECT

                                escalation_id::text

                                    AS escalation_id

                            FROM public.escalations

                            WHERE ticket_id =

                                  CAST(

                                      :ticket_id

                                      AS UUID

                                  )



                              AND target_role =

                                  'HOD'



                              AND escalation_status

                                  IN (

                                      'OPEN',

                                      'ACKNOWLEDGED'

                                  )



                            ORDER BY

                                escalated_at DESC,

                                escalation_id DESC

                            LIMIT 1

                            FOR UPDATE

                            """

                        ),

                        {

                            "ticket_id": str(

                                ticket["ticket_id"]

                            ),

                        },

                    ).mappings().first()

                )



                if current_hod_escalation is None:

                    raise HTTPException(

                        409,

                        (

                            "No active HOD "

                            "escalation exists for "

                            "this query."

                        ),

                    )



                active_admin_escalation = (

                    db.execute(

                        text(

                            """

                            SELECT escalation_id

                            FROM public.escalations

                            WHERE ticket_id =

                                  CAST(

                                      :ticket_id

                                      AS UUID

                                  )



                              AND target_role =

                                  'ADMIN'



                              AND escalation_status

                                  IN (

                                      'OPEN',

                                      'ACKNOWLEDGED'

                                  )

                            LIMIT 1

                            """

                        ),

                        {

                            "ticket_id": str(

                                ticket["ticket_id"]

                            ),

                        },

                    ).first()

                )



                if active_admin_escalation is not None:

                    raise HTTPException(

                        409,

                        (

                            "This query is already "

                            "escalated to Admin."

                        ),

                    )



                admin_target = (

                    db.execute(

                        text(

                            """

                            SELECT

                                user_id::text

                                    AS user_id,



                                full_name,

                                email

                            FROM public.users

                            WHERE role = 'ADMIN'

                              AND is_active = TRUE

                            ORDER BY

                                created_at,

                                user_id

                            LIMIT 1

                            """

                        )

                    ).mappings().first()

                )



                if admin_target is None:

                    raise HTTPException(

                        503,

                        (

                            "No active administrator "

                            "is available for "

                            "escalation."

                        ),

                    )



                new_status = "ESCALATED"



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



            elif action == "OVERRIDE":

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



                        WHERE ticket_id =

                              CAST(

                                  :ticket_id

                                  AS UUID

                              )



                          AND target_role = 'HOD'



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



            elif action == "ESCALATE_ADMIN":

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

                            current_hod_escalation[

                                "escalation_id"

                            ],

                        "event_at": event_at,

                    },

                )



                admin_event_key = (

                    "hod-admin:"

                    + str(uuid4())

                )



                admin_escalation = (

                    db.execute(

                        text(

                            """

                            INSERT INTO public.escalations (

                                ticket_id,

                                department_id,

                                escalated_from_user_id,

                                escalated_to_user_id,

                                escalated_by_user_id,

                                escalated_by_service,

                                target_role,

                                escalation_type,

                                event_key,

                                reason,

                                escalation_status,

                                escalated_at,

                                acknowledged_at,

                                resolved_at

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

                                    :from_user_id

                                    AS UUID

                                ),

                                CAST(

                                    :admin_user_id

                                    AS UUID

                                ),

                                CAST(

                                    :actor_id

                                    AS UUID

                                ),

                                NULL,

                                'ADMIN',

                                'MANUAL',

                                :event_key,

                                :reason,

                                'OPEN',

                                :event_at,

                                NULL,

                                NULL

                            )

                            RETURNING

                                escalation_id::text

                                    AS escalation_id

                            """

                        ),

                        {

                            "ticket_id": updated[

                                "ticket_id"

                            ],

                            "department_id": ticket[

                                "ticket_department_id"

                            ],

                            "from_user_id": (

                                str(assignee)

                                if assignee

                                else None

                            ),

                            "admin_user_id":

                                admin_target[

                                    "user_id"

                                ],

                            "actor_id": actor[

                                "user_id"

                            ],

                            "event_key":

                                admin_event_key,

                            "reason": reason,

                            "event_at": event_at,

                        },

                    ).mappings().first()

                )



                if admin_escalation is None:

                    raise HTTPException(

                        500,

                        (

                            "Admin escalation could "

                            "not be created."

                        ),

                    )



                admin_escalation_id = (

                    admin_escalation[

                        "escalation_id"

                    ]

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



            action_note = (

                (

                    "HOD override decision: "

                    + reason

                )

                if action == "OVERRIDE"

                else (

                    (

                        "HOD escalated query to "

                        "Admin: "

                        + reason

                    )

                    if action

                    == "ESCALATE_ADMIN"

                    else (

                        "Ticket action: "

                        + action

                        + "."

                    )

                )

            )



            if action == "OVERRIDE":

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

                            CAST(:ticket_id AS UUID),

                            CAST(:actor_id AS UUID),

                            :previous_status,

                            :new_status,

                            :change_note,

                            :event_at

                        )

                        """

                    ),

                    {

                        "ticket_id": updated[

                            "ticket_id"

                        ],

                        "actor_id": actor[

                            "user_id"

                        ],

                        "previous_status": old_status,

                        "new_status": updated[

                            "status"

                        ],

                        "change_note": action_note,

                        "event_at": event_at,

                    },

                )



                old_values = {

                    "status": old_status,

                    "assigned_officer_id": (

                        str(

                            ticket[

                                "assigned_officer_id"

                            ]

                        )

                        if ticket.get(

                            "assigned_officer_id"

                        )

                        else None

                    ),

                    "routed_desk_id": (

                        str(

                            ticket[

                                "routed_desk_id"

                            ]

                        )

                        if ticket.get(

                            "routed_desk_id"

                        )

                        else None

                    ),

                    "resolved_at": ticket.get(

                        "resolved_at"

                    ),

                }



                new_values = {

                    "status": updated[

                        "status"

                    ],

                    "assigned_officer_id": updated.get(

                        "assigned_officer_id"

                    ),

                    "routed_desk_id": updated.get(

                        "routed_desk_id"

                    ),

                    "resolved_at": updated.get(

                        "resolved_at"

                    ),

                }



                db.execute(

                    text(

                        """

                        INSERT INTO public.audit_logs (

                            actor_user_id,

                            action,

                            entity_type,

                            entity_id,

                            old_values,

                            new_values,

                            details,

                            created_at

                        )

                        VALUES (

                            CAST(:actor_id AS UUID),

                            'TICKET_OVERRIDE',

                            'TICKET',

                            CAST(:ticket_id AS UUID),

                            CAST(:old_values AS JSONB),

                            CAST(:new_values AS JSONB),

                            CAST(:details AS JSONB),

                            :event_at

                        )

                        """

                    ),

                    {

                        "actor_id": actor[

                            "user_id"

                        ],

                        "ticket_id": updated[

                            "ticket_id"

                        ],

                        "old_values": json.dumps(

                            old_values,

                            default=str,

                        ),

                        "new_values": json.dumps(

                            new_values,

                            default=str,

                        ),

                        "details": json.dumps(

                            {

                                "override_reason":

                                    reason,

                            },

                            default=str,

                        ),

                        "event_at": event_at,

                    },

                )



            elif action == "ESCALATE_ADMIN":

                old_values = {

                    "status": old_status,

                    "assigned_officer_id": (

                        str(

                            ticket[

                                "assigned_officer_id"

                            ]

                        )

                        if ticket.get(

                            "assigned_officer_id"

                        )

                        else None

                    ),

                    "routed_desk_id": (

                        str(

                            ticket[

                                "routed_desk_id"

                            ]

                        )

                        if ticket.get(

                            "routed_desk_id"

                        )

                        else None

                    ),

                    "resolved_at": ticket.get(

                        "resolved_at"

                    ),

                }



                new_values = {

                    "status": updated[

                        "status"

                    ],

                    "assigned_officer_id": updated.get(

                        "assigned_officer_id"

                    ),

                    "routed_desk_id": updated.get(

                        "routed_desk_id"

                    ),

                    "resolved_at": updated.get(

                        "resolved_at"

                    ),

                }



                db.execute(

                    text(

                        """

                        INSERT INTO public.audit_logs (

                            actor_user_id,

                            action,

                            entity_type,

                            entity_id,

                            old_values,

                            new_values,

                            details,

                            created_at

                        )

                        VALUES (

                            CAST(:actor_id AS UUID),

                            'TICKET_ESCALATE_ADMIN',

                            'TICKET',

                            CAST(:ticket_id AS UUID),

                            CAST(:old_values AS JSONB),

                            CAST(:new_values AS JSONB),

                            CAST(:details AS JSONB),

                            :event_at

                        )

                        """

                    ),

                    {

                        "actor_id": actor[

                            "user_id"

                        ],

                        "ticket_id": updated[

                            "ticket_id"

                        ],

                        "old_values": json.dumps(

                            old_values,

                            default=str,

                        ),

                        "new_values": json.dumps(

                            new_values,

                            default=str,

                        ),

                        "details": json.dumps(

                            {

                                "escalation_reason":

                                    reason,

                                "target_role":

                                    "ADMIN",

                                "escalated_to_user_id":

                                    admin_target[

                                        "user_id"

                                    ],

                                "escalated_to_name":

                                    admin_target.get(

                                        "full_name"

                                    ),

                                "escalated_to_email":

                                    admin_target.get(

                                        "email"

                                    ),

                                "admin_escalation_id":

                                    admin_escalation_id,

                            },

                            default=str,

                        ),

                        "event_at": event_at,

                    },

                )



            else:

                record_ticket_change(

                    db,

                    actor["user_id"],

                    ticket,

                    updated,

                    "TICKET_" + action,

                    action_note,

                    event_at,

                )



            if (

                action == "ESCALATE_ADMIN"

                and admin_target is not None

            ):

                updated = {

                    **updated,

                    "admin_escalation_id":

                        admin_escalation_id,

                    "escalated_to_admin": {

                        "user_id":

                            admin_target[

                                "user_id"

                            ],

                        "full_name":

                            admin_target.get(

                                "full_name"

                            ),

                        "email":

                            admin_target.get(

                                "email"

                            ),

                    },

                }



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

            "HOD",

        ),

    )





def approve_or_reassign_ticket(

    ticket_number: str,

    action: str,

    new_officer_id: str | None,

    current_user: dict[str, Any],

    reason: str | None = None,

) -> dict[str, Any]:

    action = action.strip().upper()



    if action not in {

        "APPROVE",

        "REJECT",

        "REASSIGN",

        "OVERRIDE",

        "ESCALATE_ADMIN",

    }:

        raise HTTPException(

            422,

            "Invalid HOD action.",

        )



    cleaned_reason = (

        reason.strip()

        if isinstance(reason, str)

        else None

    )



    if action in {

        "OVERRIDE",

        "ESCALATE_ADMIN",

    }:

        if (

            not cleaned_reason

            or len(cleaned_reason) < 5

        ):

            raise HTTPException(

                422,

                (

                    "Decision reason must be "

                    "at least 5 characters."

                ),

            )



        if len(cleaned_reason) > 500:

            raise HTTPException(

                422,

                (

                    "Decision reason cannot "

                    "exceed 500 characters."

                ),

            )



    return _apply_action(

        ticket_number,

        current_user,

        action,

        ("HOD",),

        new_officer_id,

        cleaned_reason,

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



                        t.assigned_officer_id::text AS assigned_officer_id,



                        t.routed_desk_id::text AS routed_desk_id,



                        officer.full_name AS assignee_name,



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

                            EXISTS (

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

                            EXISTS (

                                SELECT 1

                                FROM public.escalations e

                                WHERE e.ticket_id =

                                      t.ticket_id



                                  AND e.target_role =

                                      'HOD'



                                  AND

                                    e.escalation_status =

                                      'OPEN'

                            )

                        )

                            AS has_active_hod_escalation,



                        (

                            SELECT e.target_role

                            FROM public.escalations e

                            WHERE e.ticket_id =

                                  t.ticket_id



                              AND

                                e.escalation_status

                                IN (

                                    'OPEN',

                                    'ACKNOWLEDGED'

                                )

                            ORDER BY

                                e.escalated_at DESC,

                                e.escalation_id DESC

                            LIMIT 1

                        )

                            AS active_escalation_target_role,



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

            role,

            is_active,

            is_available,

            desk_id::text AS desk_id

        FROM public.users

        WHERE department_id =

              CAST(:department_id AS UUID)

          AND role IN (

              'DEPARTMENT_STAFF',

              'INSTRUCTOR'

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

                    ticket.get(

                        "active_escalation_target_role"

                    )

                    != "ADMIN"

                    and (

                        ticket[

                            "has_active_hod_escalation"

                        ]

                        or ticket["is_overdue"]

                        or ticket[

                            "requires_manual_review"

                        ]

                        or not ticket[

                            "assigned_officer_id"

                        ]

                    )

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

                                "has_active_hod_escalation"

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