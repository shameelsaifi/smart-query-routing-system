from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal


def start_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    officer_id = current_user.get("user_id")

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_number,
                    assigned_officer_id::text AS assigned_officer_id,
                    status
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found.",
            )

        if ticket["assigned_officer_id"] != officer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This ticket is not assigned to you.",
            )

        if ticket["status"] != "ROUTED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only routed tickets can be moved "
                    "to in-progress."
                ),
            )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    status = 'IN_PROGRESS',
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    subject,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        db.commit()

        return dict(updated_ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket status could not be updated.",
        ) from exc

    finally:
        db.close()


def resolve_ticket(
    ticket_number: str,
    current_user: dict[str, Any],
) -> dict[str, Any]:
    officer_id = current_user.get("user_id")

    if not officer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user profile is incomplete.",
        )

    db = SessionLocal()

    try:
        ticket = db.execute(
            text(
                """
                SELECT
                    ticket_number,
                    assigned_officer_id::text AS assigned_officer_id,
                    status
                FROM public.tickets
                WHERE ticket_number = :ticket_number
                LIMIT 1
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        if ticket is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found.",
            )

        if ticket["assigned_officer_id"] != officer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This ticket is not assigned to you.",
            )

        if ticket["status"] != "IN_PROGRESS":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only in-progress tickets can be resolved."
                ),
            )

        updated_ticket = db.execute(
            text(
                """
                UPDATE public.tickets
                SET
                    status = 'RESOLVED',
                    updated_at = NOW()
                WHERE ticket_number = :ticket_number
                RETURNING
                    ticket_number,
                    subject,
                    category,
                    priority,
                    confidence,
                    status
                """
            ),
            {
                "ticket_number": ticket_number,
            },
        ).mappings().first()

        db.commit()

        return dict(updated_ticket)

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError as exc:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ticket could not be resolved.",
        ) from exc

    finally:
        db.close()


def get_hod_dashboard_stats(current_user: dict[str, Any]) -> dict[str, Any]:
    department_id = current_user.get("department_id")
    
    if not department_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="HOD department mapping is missing.",
        )

    db = SessionLocal()
    try:
        # 1. High-Level Metrics & Escalated Tickets (Fixed ambiguous columns by adding t.)
        stats = db.execute(
            text("""
            SELECT 
                COUNT(*) as total_queries,
                COUNT(*) FILTER (WHERE t.status IN ('PENDING', 'IN_PROGRESS', 'ROUTED')) as active_queries,
                COUNT(*) FILTER (WHERE t.status = 'ESCALATED' OR t.created_at < NOW() - INTERVAL '48 hours') as escalated_queries,
                COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/3600)::numeric, 1), 0) as avg_resolution_hours
            FROM public.tickets t
            LEFT JOIN public.users u ON t.assigned_officer_id = u.user_id
            WHERE u.department_id = CAST(:department_id AS UUID)
            """),
            {"department_id": department_id}
        ).mappings().first()

        # 2. Officer Workload
        officer_load = db.execute(
            text("""
            SELECT u.full_name, COUNT(t.ticket_number) as active_tickets
            FROM public.users u
            LEFT JOIN public.tickets t ON u.user_id = t.assigned_officer_id 
                AND t.status IN ('PENDING', 'IN_PROGRESS', 'ROUTED')
            WHERE u.department_id = CAST(:department_id AS UUID) AND u.role = 'DEPARTMENT_STAFF'
            GROUP BY u.full_name
            """),
            {"department_id": department_id}
        ).mappings().all()

        # 3. Escalated / Action Required Tickets Queue
        escalated_queue = db.execute(
            text("""
            SELECT 
                t.ticket_number, t.subject, t.priority, t.status, 
                t.created_at, u.full_name as assignee_name, ad.desk_name
            FROM public.tickets t
            LEFT JOIN public.users u ON t.assigned_officer_id = u.user_id
            LEFT JOIN public.accounts_desks ad ON t.routed_desk_id = ad.desk_id
            WHERE u.department_id = CAST(:department_id AS UUID) 
              AND (t.status = 'ESCALATED' OR t.status = 'PENDING_APPROVAL' OR t.created_at < NOW() - INTERVAL '48 hours')
            ORDER BY t.created_at ASC
            """),
            {"department_id": department_id}
        ).mappings().all()

        return {
            "metrics": dict(stats) if stats else {},
            "officer_workload": [dict(row) for row in officer_load],
            "action_required_queue": [dict(row) for row in escalated_queue]
        }
    except SQLAlchemyError as exc:
        print(f"\n\n=== DB ERROR IN HOD DASHBOARD ===\n{str(exc)}\n=================================\n\n")
        raise HTTPException(status_code=500, detail="Failed to load HOD dashboard stats.") from exc
    finally:
        db.close()


def approve_or_reassign_ticket(
    ticket_number: str, 
    action: str, 
    new_officer_id: str | None, 
    current_user: dict[str, Any]
) -> dict[str, Any]:
    db = SessionLocal()
    try:
        if action in ["APPROVE", "REJECT"]:
            new_status = "RESOLVED" if action == "APPROVE" else "IN_PROGRESS"
            updated = db.execute(
                text("""
                UPDATE public.tickets 
                SET status = :status, updated_at = NOW() 
                WHERE ticket_number = :ticket_number 
                RETURNING ticket_number, status
                """),
                {"status": new_status, "ticket_number": ticket_number}
            ).mappings().first()
            
        elif action == "REASSIGN" and new_officer_id:
            updated = db.execute(
                text("""
                UPDATE public.tickets 
                SET assigned_officer_id = CAST(:new_officer_id AS UUID), status = 'ROUTED', updated_at = NOW() 
                WHERE ticket_number = :ticket_number 
                RETURNING ticket_number, assigned_officer_id, status
                """),
                {"new_officer_id": new_officer_id, "ticket_number": ticket_number}
            ).mappings().first()

        db.commit()
        return dict(updated)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ticket {action.lower()} failed.") from exc
    finally:
        db.close()