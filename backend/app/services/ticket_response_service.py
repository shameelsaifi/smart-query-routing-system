import json

from typing import Any



from fastapi import HTTPException

from sqlalchemy import text

from sqlalchemy.exc import SQLAlchemyError



from app.core.database import SessionLocal



from app.schemas.ticket_response import (

    TicketResponseApprove,

    TicketResponseDraftUpdate,

)



from app.services.ticket_access_service import (

    load_ticket_actor,

    lock_accessible_ticket,

    record_ticket_change,

)





RESPONSE_WORK_STATUSES = {

    "IN_PROGRESS",

    "ESCALATED",

}





def _load_student_email(

    db,

    student_id,

) -> str:

    email = db.execute(

        text(

            """

            SELECT lower(email)

            FROM public.users

            WHERE user_id =

                  CAST(:student_id AS UUID)

            LIMIT 1

            """

        ),

        {

            "student_id": str(student_id),

        },

    ).scalar_one_or_none()



    if not email:

        raise HTTPException(

            409,

            "The student email address is unavailable.",

        )



    return email





def _load_latest_final_response(

    db,

    ticket_id,

    *,

    for_update: bool = False,

):

    locking = (

        " FOR UPDATE"

        if for_update

        else ""

    )



    return db.execute(

        text(

            """

            SELECT

                response_id::text AS response_id,

                ticket_id::text AS ticket_id,

                ai_log_id::text AS ai_log_id,

                response_type,

                responder_id::text AS responder_id,

                ai_draft_text,

                final_response_text,

                approval_status,

                approved_at,

                delivery_status,

                recipient_email,

                gmail_account_email,

                gmail_message_id,

                gmail_thread_id,

                failure_reason,

                revision,

                created_at,

                updated_at,

                sent_at

            FROM public.responses

            WHERE ticket_id =

                  CAST(:ticket_id AS UUID)

              AND response_type = 'FINAL'

            ORDER BY

                created_at DESC,

                response_id DESC

            LIMIT 1

            """

            + locking

        ),

        {

            "ticket_id": str(ticket_id),

        },

    ).mappings().first()





def _serialize_response(

    ticket,

    response,

    recipient_email,

) -> dict[str, Any]:

    if response is None:

        draft = ticket.get(

            "ai_draft_reply"

        )



        return {

            "response_id": None,

            "ticket_number": (

                ticket["ticket_number"]

            ),

            "ticket_status": (

                ticket["status"]

            ),

            "response_type": "FINAL",

            "recipient_email": (

                recipient_email

            ),

            "ai_draft_text": draft,

            "final_response_text": draft,

            "approval_status": (

                "PENDING_REVIEW"

            ),

            "delivery_status": (

                "NOT_QUEUED"

            ),

            "revision": 0,

            "approved_at": None,

            "sent_at": None,

            "editable": (

                ticket["status"]

                in RESPONSE_WORK_STATUSES

            ),

            "approvable": False,

        }



    final_text = response[

        "final_response_text"

    ]



    editable = (

        ticket["status"]

        in RESPONSE_WORK_STATUSES

        and response["delivery_status"]

        == "NOT_QUEUED"

        and response["approval_status"]

        in {

            "PENDING_REVIEW",

            "REJECTED",

        }

    )



    approvable = (

        editable

        and response["approval_status"]

        == "PENDING_REVIEW"

        and isinstance(

            final_text,

            str,

        )

        and bool(final_text.strip())

    )



    return {

        "response_id": (

            response["response_id"]

        ),

        "ticket_number": (

            ticket["ticket_number"]

        ),

        "ticket_status": (

            ticket["status"]

        ),

        "response_type": (

            response["response_type"]

        ),

        "recipient_email": (

            response["recipient_email"]

            or recipient_email

        ),

        "ai_draft_text": (

            response["ai_draft_text"]

            or ticket.get(

                "ai_draft_reply"

            )

        ),

        "final_response_text": (

            final_text

        ),

        "approval_status": (

            response[

                "approval_status"

            ]

        ),

        "delivery_status": (

            response[

                "delivery_status"

            ]

        ),

        "revision": (

            response["revision"]

        ),

        "approved_at": (

            response["approved_at"]

        ),

        "sent_at": (

            response["sent_at"]

        ),

        "editable": editable,

        "approvable": approvable,

    }





def _record_response_audit(

    db,

    *,

    actor_id: str,

    response_id: str,

    action: str,

    old_values: dict[str, Any] | None,

    new_values: dict[str, Any],

    event_at,

) -> None:

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

                created_at

            )

            VALUES (

                CAST(:actor_id AS UUID),

                :action,

                'RESPONSE',

                CAST(:response_id AS UUID),

                CAST(:old_values AS JSONB),

                CAST(:new_values AS JSONB),

                :event_at

            )

            """

        ),

        {

            "actor_id": actor_id,

            "action": action,

            "response_id": (

                response_id

            ),

            "old_values": (

                json.dumps(

                    old_values,

                    default=str,

                )

                if old_values

                is not None

                else None

            ),

            "new_values": json.dumps(

                new_values,

                default=str,

            ),

            "event_at": event_at,

        },

    )





def get_ticket_response(

    ticket_number: str,

    current_user: dict[str, Any],

) -> dict[str, Any]:

    try:

        with SessionLocal() as db:

            actor = load_ticket_actor(

                db,

                current_user,

                "DEPARTMENT_STAFF",

                "INSTRUCTOR",

                "HOD",

            )



            ticket = lock_accessible_ticket(

                db,

                ticket_number,

                actor,

            )



            recipient_email = (

                _load_student_email(

                    db,

                    ticket["student_id"],

                )

            )



            response = (

                _load_latest_final_response(

                    db,

                    ticket["ticket_id"],

                )

            )



            return _serialize_response(

                ticket,

                response,

                recipient_email,

            )



    except SQLAlchemyError as exc:

        raise HTTPException(

            503,

            (

                "Ticket response is "

                "temporarily unavailable."

            ),

        ) from exc





def save_ticket_response(

    ticket_number: str,

    current_user: dict[str, Any],

    data: TicketResponseDraftUpdate,

) -> dict[str, Any]:

    try:

        with SessionLocal.begin() as db:

            actor = load_ticket_actor(

                db,

                current_user,

                "DEPARTMENT_STAFF",

                "INSTRUCTOR",

                "HOD",

            )



            ticket = lock_accessible_ticket(

                db,

                ticket_number,

                actor,

            )



            if (

                ticket["status"]

                not in RESPONSE_WORK_STATUSES

            ):

                raise HTTPException(

                    409,

                    (

                        "A final response can only "

                        "be edited while the ticket "

                        "is in progress or escalated."

                    ),

                )



            recipient_email = (

                _load_student_email(

                    db,

                    ticket["student_id"],

                )

            )



            existing = (

                _load_latest_final_response(

                    db,

                    ticket["ticket_id"],

                    for_update=True,

                )

            )



            event_at = db.execute(

                text(

                    "SELECT clock_timestamp()"

                )

            ).scalar_one()



            if existing is None:

                if data.expected_revision not in {

                    None,

                    0,

                }:

                    raise HTTPException(

                        409,

                        (

                            "Response revision "

                            "conflict. Refresh and "

                            "try again."

                        ),

                    )



                row = db.execute(

                    text(

                        """

                        INSERT INTO public.responses (

                            ticket_id,

                            response_type,

                            responder_id,

                            ai_draft_text,

                            final_response_text,

                            approval_status,

                            delivery_status,

                            recipient_email,

                            revision,

                            created_at,

                            updated_at

                        )

                        VALUES (

                            CAST(

                                :ticket_id

                                AS UUID

                            ),

                            'FINAL',

                            CAST(

                                :responder_id

                                AS UUID

                            ),

                            :ai_draft_text,

                            :final_response_text,

                            'PENDING_REVIEW',

                            'NOT_QUEUED',

                            :recipient_email,

                            1,

                            :event_at,

                            :event_at

                        )

                        RETURNING

                            response_id::text

                                AS response_id,

                            ticket_id::text

                                AS ticket_id,

                            ai_log_id::text

                                AS ai_log_id,

                            response_type,

                            responder_id::text

                                AS responder_id,

                            ai_draft_text,

                            final_response_text,

                            approval_status,

                            approved_at,

                            delivery_status,

                            recipient_email,

                            gmail_account_email,

                            gmail_message_id,

                            gmail_thread_id,

                            failure_reason,

                            revision,

                            created_at,

                            updated_at,

                            sent_at

                        """

                    ),

                    {

                        "ticket_id": str(

                            ticket[

                                "ticket_id"

                            ]

                        ),

                        "responder_id": (

                            actor["user_id"]

                        ),

                        "ai_draft_text": (

                            ticket.get(

                                "ai_draft_reply"

                            )

                        ),

                        "final_response_text": (

                            data.final_response_text

                        ),

                        "recipient_email": (

                            recipient_email

                        ),

                        "event_at": event_at,

                    },

                ).mappings().first()



                if row is None:

                    raise HTTPException(

                        500,

                        (

                            "Response could not "

                            "be created."

                        ),

                    )



                response = dict(row)



                _record_response_audit(

                    db,

                    actor_id=actor[

                        "user_id"

                    ],

                    response_id=response[

                        "response_id"

                    ],

                    action=(

                        "RESPONSE_DRAFT_CREATED"

                    ),

                    old_values=None,

                    new_values={

                        "approval_status": (

                            response[

                                "approval_status"

                            ]

                        ),

                        "delivery_status": (

                            response[

                                "delivery_status"

                            ]

                        ),

                        "revision": (

                            response[

                                "revision"

                            ]

                        ),

                    },

                    event_at=event_at,

                )



            else:

                if (

                    existing[

                        "delivery_status"

                    ]

                    != "NOT_QUEUED"

                ):

                    raise HTTPException(

                        409,

                        (

                            "This response has "

                            "already entered the "

                            "delivery workflow."

                        ),

                    )



                if (

                    existing[

                        "approval_status"

                    ]

                    == "APPROVED"

                ):

                    raise HTTPException(

                        409,

                        (

                            "An approved response "

                            "cannot be edited."

                        ),

                    )



                if (

                    data.expected_revision

                    is not None

                    and

                    data.expected_revision

                    != existing["revision"]

                ):

                    raise HTTPException(

                        409,

                        (

                            "Response revision "

                            "conflict. Refresh and "

                            "try again."

                        ),

                    )



                old_values = {

                    "approval_status": (

                        existing[

                            "approval_status"

                        ]

                    ),

                    "delivery_status": (

                        existing[

                            "delivery_status"

                        ]

                    ),

                    "revision": (

                        existing["revision"]

                    ),

                    "final_response_text": (

                        existing[

                            "final_response_text"

                        ]

                    ),

                }



                row = db.execute(

                    text(

                        """

                        UPDATE public.responses

                        SET

                            responder_id =

                                CAST(

                                    :responder_id

                                    AS UUID

                                ),



                            final_response_text =

                                :final_response_text,



                            approval_status =

                                'PENDING_REVIEW',



                            approved_at = NULL,



                            recipient_email =

                                :recipient_email,



                            revision =

                                revision + 1,



                            updated_at =

                                :event_at



                        WHERE response_id =

                              CAST(

                                  :response_id

                                  AS UUID

                              )



                        RETURNING

                            response_id::text

                                AS response_id,

                            ticket_id::text

                                AS ticket_id,

                            ai_log_id::text

                                AS ai_log_id,

                            response_type,

                            responder_id::text

                                AS responder_id,

                            ai_draft_text,

                            final_response_text,

                            approval_status,

                            approved_at,

                            delivery_status,

                            recipient_email,

                            gmail_account_email,

                            gmail_message_id,

                            gmail_thread_id,

                            failure_reason,

                            revision,

                            created_at,

                            updated_at,

                            sent_at

                        """

                    ),

                    {

                        "responder_id": (

                            actor["user_id"]

                        ),

                        "final_response_text": (

                            data.final_response_text

                        ),

                        "recipient_email": (

                            recipient_email

                        ),

                        "event_at": event_at,

                        "response_id": (

                            existing[

                                "response_id"

                            ]

                        ),

                    },

                ).mappings().first()



                response = dict(row)



                _record_response_audit(

                    db,

                    actor_id=actor[

                        "user_id"

                    ],

                    response_id=response[

                        "response_id"

                    ],

                    action=(

                        "RESPONSE_DRAFT_UPDATED"

                    ),

                    old_values=old_values,

                    new_values={

                        "approval_status": (

                            response[

                                "approval_status"

                            ]

                        ),

                        "delivery_status": (

                            response[

                                "delivery_status"

                            ]

                        ),

                        "revision": (

                            response[

                                "revision"

                            ]

                        ),

                        "final_response_text": (

                            response[

                                "final_response_text"

                            ]

                        ),

                    },

                    event_at=event_at,

                )



            return _serialize_response(

                ticket,

                response,

                recipient_email,

            )



    except SQLAlchemyError as exc:

        raise HTTPException(

            503,

            (

                "Response could not be "

                "saved. Please try again."

            ),

        ) from exc





def approve_ticket_response(

    ticket_number: str,

    current_user: dict[str, Any],

    data: TicketResponseApprove,

) -> dict[str, Any]:

    try:

        with SessionLocal.begin() as db:

            actor = load_ticket_actor(

                db,

                current_user,

                "DEPARTMENT_STAFF",

                "INSTRUCTOR",

                "HOD",

            )



            ticket = lock_accessible_ticket(

                db,

                ticket_number,

                actor,

            )



            if (

                ticket["status"]

                not in RESPONSE_WORK_STATUSES

            ):

                raise HTTPException(

                    409,

                    (

                        "This ticket is not "

                        "ready for response "

                        "approval."

                    ),

                )



            recipient_email = (

                _load_student_email(

                    db,

                    ticket["student_id"],

                )

            )



            existing = (

                _load_latest_final_response(

                    db,

                    ticket["ticket_id"],

                    for_update=True,

                )

            )



            if existing is None:

                raise HTTPException(

                    409,

                    (

                        "Save the final response "

                        "before approving it."

                    ),

                )



            if (

                existing["delivery_status"]

                != "NOT_QUEUED"

            ):

                raise HTTPException(

                    409,

                    (

                        "This response has "

                        "already entered the "

                        "delivery workflow."

                    ),

                )



            if (

                existing["approval_status"]

                == "APPROVED"

            ):

                return _serialize_response(

                    ticket,

                    existing,

                    recipient_email,

                )



            if (

                existing["approval_status"]

                != "PENDING_REVIEW"

            ):

                raise HTTPException(

                    409,

                    (

                        "Only a pending response "

                        "can be approved."

                    ),

                )



            if (

                existing["revision"]

                != data.expected_revision

            ):

                raise HTTPException(

                    409,

                    (

                        "Response revision "

                        "conflict. Refresh and "

                        "try again."

                    ),

                )



            final_text = existing[

                "final_response_text"

            ]



            if (

                not isinstance(

                    final_text,

                    str,

                )

                or not final_text.strip()

            ):

                raise HTTPException(

                    409,

                    (

                        "Final response text "

                        "is required."

                    ),

                )



            event_at = db.execute(

                text(

                    "SELECT clock_timestamp()"

                )

            ).scalar_one()



            old_values = {

                "approval_status": (

                    existing[

                        "approval_status"

                    ]

                ),

                "delivery_status": (

                    existing[

                        "delivery_status"

                    ]

                ),

                "revision": (

                    existing["revision"]

                ),

            }



            row = db.execute(

                text(

                    """

                    UPDATE public.responses

                    SET

                        responder_id =

                            CAST(

                                :responder_id

                                AS UUID

                            ),



                        approval_status =

                            'APPROVED',



                        approved_at =

                            :event_at,



                        recipient_email =

                            :recipient_email,



                        updated_at =

                            :event_at



                    WHERE response_id =

                          CAST(

                              :response_id

                              AS UUID

                          )



                    RETURNING

                        response_id::text

                            AS response_id,

                        ticket_id::text

                            AS ticket_id,

                        ai_log_id::text

                            AS ai_log_id,

                        response_type,

                        responder_id::text

                            AS responder_id,

                        ai_draft_text,

                        final_response_text,

                        approval_status,

                        approved_at,

                        delivery_status,

                        recipient_email,

                        gmail_account_email,

                        gmail_message_id,

                        gmail_thread_id,

                        failure_reason,

                        revision,

                        created_at,

                        updated_at,

                        sent_at

                    """

                ),

                {

                    "responder_id": (

                        actor["user_id"]

                    ),

                    "recipient_email": (

                        recipient_email

                    ),

                    "event_at": event_at,

                    "response_id": (

                        existing[

                            "response_id"

                        ]

                    ),

                },

            ).mappings().first()



            if row is None:

                raise HTTPException(

                    500,

                    (

                        "Response approval "

                        "could not be completed."

                    ),

                )



            response = dict(row)



            _record_response_audit(

                db,

                actor_id=actor["user_id"],

                response_id=response[

                    "response_id"

                ],

                action=(

                    "RESPONSE_APPROVED"

                ),

                old_values=old_values,

                new_values={

                    "approval_status": (

                        response[

                            "approval_status"

                        ]

                    ),

                    "delivery_status": (

                        response[

                            "delivery_status"

                        ]

                    ),

                    "revision": (

                        response[

                            "revision"

                        ]

                    ),

                },

                event_at=event_at,

            )



            return _serialize_response(

                ticket,

                response,

                recipient_email,

            )



    except SQLAlchemyError as exc:

        raise HTTPException(

            503,

            (

                "Response approval could "

                "not complete."

            ),

        ) from exc





def create_information_request(

    ticket_number: str,

    current_user: dict[str, Any],

    message: str,

) -> dict[str, Any]:

    allowed_statuses = {

        "IN_PROGRESS",

        "ESCALATED",

    }



    try:

        with SessionLocal.begin() as db:

            actor = load_ticket_actor(

                db,

                current_user,

                "DEPARTMENT_STAFF",

                "INSTRUCTOR",

            )



            ticket = lock_accessible_ticket(

                db,

                ticket_number,

                actor,

            )



            if (

                ticket["status"]

                not in allowed_statuses

            ):

                raise HTTPException(

                    409,

                    (

                        "More information can only "

                        "be requested while the ticket "

                        "is in progress or escalated."

                    ),

                )



            cleaned_message = (

                message.strip()

            )



            if not cleaned_message:

                raise HTTPException(

                    422,

                    (

                        "Information request "

                        "cannot be empty."

                    ),

                )



            recipient_email = (

                _load_student_email(

                    db,

                    ticket["student_id"],

                )

            )



            event_at = db.execute(

                text(

                    "SELECT clock_timestamp()"

                )

            ).scalar_one()



            response_row = db.execute(

                text(

                    """

                    INSERT INTO public.responses (

                        ticket_id,

                        response_type,

                        responder_id,

                        final_response_text,

                        approval_status,

                        approved_at,

                        delivery_status,

                        recipient_email,

                        revision,

                        created_at,

                        updated_at

                    )

                    VALUES (

                        CAST(

                            :ticket_id

                            AS UUID

                        ),

                        'INFORMATION_REQUEST',

                        CAST(

                            :responder_id

                            AS UUID

                        ),

                        :message,

                        'APPROVED',

                        :event_at,

                        'NOT_QUEUED',

                        :recipient_email,

                        1,

                        :event_at,

                        :event_at

                    )

                    RETURNING

                        response_id::text

                            AS response_id,

                        response_type,

                        final_response_text,

                        approval_status,

                        delivery_status,

                        recipient_email,

                        revision,

                        approved_at

                    """

                ),

                {

                    "ticket_id": str(

                        ticket[

                            "ticket_id"

                        ]

                    ),

                    "responder_id": (

                        actor["user_id"]

                    ),

                    "message": (

                        cleaned_message

                    ),

                    "recipient_email": (

                        recipient_email

                    ),

                    "event_at": event_at,

                },

            ).mappings().first()



            if response_row is None:

                raise HTTPException(

                    500,

                    (

                        "Information request "

                        "could not be created."

                    ),

                )



            response = dict(

                response_row

            )



            updated_row = db.execute(

                text(

                    """

                    UPDATE public.tickets

                    SET

                        status =

                            'NEEDS_INFORMATION',



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



                        resolved_at

                    """

                ),

                {

                    "ticket_id": str(

                        ticket[

                            "ticket_id"

                        ]

                    ),

                    "event_at": event_at,

                },

            ).mappings().first()



            if updated_row is None:

                raise HTTPException(

                    500,

                    (

                        "Ticket status could "

                        "not be updated."

                    ),

                )



            updated_ticket = dict(

                updated_row

            )



            record_ticket_change(

                db,

                actor["user_id"],

                ticket,

                updated_ticket,

                (

                    "TICKET_"

                    "INFORMATION_REQUESTED"

                ),

                (

                    "Additional information "

                    "requested from student."

                ),

                event_at,

            )



            _record_response_audit(

                db,

                actor_id=actor[

                    "user_id"

                ],

                response_id=response[

                    "response_id"

                ],

                action=(

                    "INFORMATION_REQUEST_CREATED"

                ),

                old_values=None,

                new_values={

                    "response_type": (

                        response[

                            "response_type"

                        ]

                    ),

                    "approval_status": (

                        response[

                            "approval_status"

                        ]

                    ),

                    "delivery_status": (

                        response[

                            "delivery_status"

                        ]

                    ),

                    "revision": (

                        response[

                            "revision"

                        ]

                    ),

                },

                event_at=event_at,

            )



            return {

                "response_id": (

                    response[

                        "response_id"

                    ]

                ),

                "ticket_number": (

                    ticket[

                        "ticket_number"

                    ]

                ),

                "ticket_status": (

                    updated_ticket[

                        "status"

                    ]

                ),

                "response_type": (

                    response[

                        "response_type"

                    ]

                ),

                "recipient_email": (

                    response[

                        "recipient_email"

                    ]

                ),

                "message": (

                    response[

                        "final_response_text"

                    ]

                ),

                "approval_status": (

                    response[

                        "approval_status"

                    ]

                ),

                "delivery_status": (

                    response[

                        "delivery_status"

                    ]

                ),

                "revision": (

                    response[

                        "revision"

                    ]

                ),

                "approved_at": (

                    response[

                        "approved_at"

                    ]

                ),

            }



    except SQLAlchemyError as exc:

        raise HTTPException(

            503,

            (

                "Information request could "

                "not be created. Please try again."

            ),

        ) from exc