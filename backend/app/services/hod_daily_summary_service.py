from datetime import datetime, timezone
from html import escape
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.services.ticket_workflow_service import (
    get_hod_dashboard_stats,
)


PAKISTAN_TZ = ZoneInfo("Asia/Karachi")

OPEN_STATUSES = {
    "PENDING",
    "CLASSIFIED",
    "ROUTED",
    "IN_PROGRESS",
    "NEEDS_INFORMATION",
    "ESCALATED",
    "PENDING_APPROVAL",
}


def _normalized_status(ticket: dict[str, Any]) -> str:
    return str(
        ticket.get("status") or ""
    ).strip().upper()


def _is_open(ticket: dict[str, Any]) -> bool:
    return (
        _normalized_status(ticket)
        in OPEN_STATUSES
    )


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        result = value
    elif isinstance(value, str):
        try:
            result = datetime.fromisoformat(
                value.replace("Z", "+00:00")
            )
        except ValueError:
            return None
    else:
        return None

    if result.tzinfo is None:
        result = result.replace(
            tzinfo=timezone.utc
        )

    return result


def _local_datetime_text(value: Any) -> str:
    parsed = _as_datetime(value)

    if parsed is None:
        return "—"

    local_value = parsed.astimezone(
        PAKISTAN_TZ
    )

    return local_value.strftime(
        "%d %b %Y, %I:%M %p"
    )


def _ticket_sort_key(
    ticket: dict[str, Any],
) -> datetime:
    for key in (
        "submitted_at",
        "created_at",
        "updated_at",
    ):
        parsed = _as_datetime(
            ticket.get(key)
        )

        if parsed is not None:
            return parsed

    return datetime.min.replace(
        tzinfo=timezone.utc
    )


def _calculate_metrics(
    tickets: list[dict[str, Any]],
    backend_metrics: dict[str, Any],
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)

    open_tickets = [
        ticket
        for ticket in tickets
        if _is_open(ticket)
    ]

    escalated = [
        ticket
        for ticket in open_tickets
        if _normalized_status(ticket)
        == "ESCALATED"
    ]

    unassigned = [
        ticket
        for ticket in open_tickets
        if not ticket.get(
            "assigned_officer_id"
        )
    ]

    overdue = [
        ticket
        for ticket in open_tickets
        if bool(
            ticket.get("is_overdue")
        )
    ]

    due_today = []

    for ticket in open_tickets:
        due = _as_datetime(
            ticket.get("sla_due_at")
        )

        if due is None:
            continue

        seconds = (
            due - now
        ).total_seconds()

        if 0 <= seconds <= 86400:
            due_today.append(ticket)

    sla_known = [
        ticket
        for ticket in open_tickets
        if _as_datetime(
            ticket.get("sla_due_at")
        )
        is not None
    ]

    within_sla_count = 0

    for ticket in sla_known:
        due = _as_datetime(
            ticket.get("sla_due_at")
        )

        if due is not None and due > now:
            within_sla_count += 1

    if sla_known:
        within_sla_percent = round(
            within_sla_count
            / len(sla_known)
            * 100
        )
    else:
        within_sla_percent = 100

    return {
        "open_queries": len(
            open_tickets
        ),
        "escalated": len(
            escalated
        ),
        "due_today": len(
            due_today
        ),
        "within_sla_percent":
            within_sla_percent,
        "unassigned": len(
            unassigned
        ),
        "overdue": len(
            overdue
        ),
        "avg_resolution_hours":
            backend_metrics.get(
                "avg_resolution_hours"
            ),
        "resolution_sample_count":
            backend_metrics.get(
                "resolution_sample_count",
                0,
            ),
    }


def _build_text_body(
    *,
    hod_name: str,
    department_name: str,
    generated_text: str,
    metrics: dict[str, Any],
    workload: list[dict[str, Any]],
    recent_tickets: list[
        dict[str, Any]
    ],
) -> str:
    lines = [
        "SmartQuery Daily HOD Summary",
        "",
        f"HOD: {hod_name}",
        (
            "Department: "
            f"{department_name}"
        ),
        f"Snapshot: {generated_text}",
        "",
        "Department Metrics",
        (
            "Open Queries: "
            f"{metrics['open_queries']}"
        ),
        (
            "Escalated: "
            f"{metrics['escalated']}"
        ),
        (
            "Due Today: "
            f"{metrics['due_today']}"
        ),
        (
            "Within SLA: "
            f"{metrics['within_sla_percent']}%"
        ),
        (
            "Unassigned: "
            f"{metrics['unassigned']}"
        ),
        (
            "Overdue: "
            f"{metrics['overdue']}"
        ),
        "",
        "Staff Workload",
    ]

    if workload:
        for officer in workload:
            lines.append(
                (
                    f"- "
                    f"{officer.get('full_name') or 'Unknown'}: "
                    f"{officer.get('active_tickets') or 0} "
                    "open"
                )
            )
    else:
        lines.append(
            "- No active staff found."
        )

    lines.extend(
        [
            "",
            "Recent Department Queries",
        ]
    )

    if recent_tickets:
        for ticket in recent_tickets:
            lines.append(
                (
                    f"- "
                    f"{ticket.get('ticket_number') or '—'}"
                    " | "
                    f"{ticket.get('subject') or 'No subject'}"
                    " | "
                    f"{ticket.get('status') or '—'}"
                    " | "
                    f"{ticket.get('assignee_name') or 'Unassigned'}"
                )
            )
    else:
        lines.append(
            "- No department queries."
        )

    lines.extend(
        [
            "",
            (
                "This is an automated "
                "SmartQuery operational summary."
            ),
        ]
    )

    return "\n".join(lines)


def _build_html_body(
    *,
    hod_name: str,
    department_name: str,
    generated_text: str,
    metrics: dict[str, Any],
    workload: list[dict[str, Any]],
    recent_tickets: list[
        dict[str, Any]
    ],
) -> str:
    workload_rows = "".join(
        (
            "<tr>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;'>"
            f"{escape(str(officer.get('full_name') or 'Unknown'))}"
            "</td>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;"
            "text-align:right;'>"
            f"{int(officer.get('active_tickets') or 0)}"
            "</td>"
            "</tr>"
        )
        for officer in workload
    )

    if not workload_rows:
        workload_rows = (
            "<tr><td colspan='2' "
            "style='padding:8px;'>"
            "No active staff found."
            "</td></tr>"
        )

    ticket_rows = "".join(
        (
            "<tr>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;'>"
            f"{escape(str(ticket.get('ticket_number') or '—'))}"
            "</td>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;'>"
            f"{escape(str(ticket.get('subject') or 'No subject'))}"
            "</td>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;'>"
            f"{escape(str(ticket.get('status') or '—'))}"
            "</td>"
            "<td style='padding:8px;"
            "border-bottom:1px solid #e5e7eb;'>"
            f"{escape(str(ticket.get('assignee_name') or 'Unassigned'))}"
            "</td>"
            "</tr>"
        )
        for ticket in recent_tickets
    )

    if not ticket_rows:
        ticket_rows = (
            "<tr><td colspan='4' "
            "style='padding:8px;'>"
            "No department queries."
            "</td></tr>"
        )

    return f"""
<!doctype html>
<html>
<body style="
    margin:0;
    padding:24px;
    background:#f4f7fb;
    font-family:Arial,sans-serif;
    color:#172033;
">
<div style="
    max-width:760px;
    margin:0 auto;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:16px;
    overflow:hidden;
">
    <div style="
        padding:28px;
        background:#2563eb;
        color:#ffffff;
    ">
        <div style="
            font-size:12px;
            font-weight:700;
            letter-spacing:1px;
            text-transform:uppercase;
        ">
            SmartQuery Daily Summary
        </div>
        <h1 style="
            margin:8px 0 4px;
            font-size:26px;
        ">
            {escape(department_name)}
        </h1>
        <div style="
            opacity:.9;
            font-size:14px;
        ">
            {escape(generated_text)}
        </div>
    </div>

    <div style="padding:26px;">
        <p style="margin-top:0;">
            Hello
            <strong>{escape(hod_name)}</strong>,
        </p>

        <p>
            Here is the current operational
            snapshot for
            <strong>{escape(department_name)}</strong>.
        </p>

        <table style="
            width:100%;
            border-collapse:collapse;
            margin:22px 0;
        ">
            <tr>
                <td style="padding:10px;">
                    <strong>Open Queries</strong><br>
                    {metrics['open_queries']}
                </td>
                <td style="padding:10px;">
                    <strong>Escalated</strong><br>
                    {metrics['escalated']}
                </td>
                <td style="padding:10px;">
                    <strong>Due Today</strong><br>
                    {metrics['due_today']}
                </td>
            </tr>
            <tr>
                <td style="padding:10px;">
                    <strong>Within SLA</strong><br>
                    {metrics['within_sla_percent']}%
                </td>
                <td style="padding:10px;">
                    <strong>Unassigned</strong><br>
                    {metrics['unassigned']}
                </td>
                <td style="padding:10px;">
                    <strong>Overdue</strong><br>
                    {metrics['overdue']}
                </td>
            </tr>
        </table>

        <h2 style="font-size:18px;">
            Staff workload
        </h2>

        <table style="
            width:100%;
            border-collapse:collapse;
            margin-bottom:24px;
        ">
            <thead>
                <tr>
                    <th style="
                        padding:8px;
                        text-align:left;
                        border-bottom:2px solid #e5e7eb;
                    ">
                        Staff member
                    </th>
                    <th style="
                        padding:8px;
                        text-align:right;
                        border-bottom:2px solid #e5e7eb;
                    ">
                        Open
                    </th>
                </tr>
            </thead>
            <tbody>
                {workload_rows}
            </tbody>
        </table>

        <h2 style="font-size:18px;">
            Recent department queries
        </h2>

        <table style="
            width:100%;
            border-collapse:collapse;
            font-size:13px;
        ">
            <thead>
                <tr>
                    <th style="padding:8px;text-align:left;">
                        Query
                    </th>
                    <th style="padding:8px;text-align:left;">
                        Subject
                    </th>
                    <th style="padding:8px;text-align:left;">
                        Status
                    </th>
                    <th style="padding:8px;text-align:left;">
                        Owner
                    </th>
                </tr>
            </thead>
            <tbody>
                {ticket_rows}
            </tbody>
        </table>

        <p style="
            margin:26px 0 0;
            color:#667085;
            font-size:12px;
        ">
            Automated operational summary generated by SmartQuery.
        </p>
    </div>
</div>
</body>
</html>
""".strip()


def build_hod_daily_summary_payloads(
) -> dict[str, Any]:
    try:
        with SessionLocal() as db:
            hods = db.execute(
                text(
                    """
                    SELECT
                        u.user_id::text
                            AS user_id,
                        u.full_name,
                        u.email,
                        d.department_name
                    FROM public.users u
                    JOIN public.departments d
                      ON d.department_id =
                         u.department_id
                    WHERE u.role = 'HOD'
                      AND u.is_active = TRUE
                    ORDER BY
                        d.department_name,
                        u.full_name,
                        u.email
                    """
                )
            ).mappings().all()

        generated_at = datetime.now(
            timezone.utc
        )

        generated_local = (
            generated_at.astimezone(
                PAKISTAN_TZ
            )
        )

        generated_text = (
            generated_local.strftime(
                "%d %b %Y, %I:%M %p"
            )
            + " PKT"
        )

        summaries = []

        for hod in hods:
            current_user = {
                "user_id": hod["user_id"],
                "email": hod["email"],
                "role": "HOD",
            }

            dashboard = (
                get_hod_dashboard_stats(
                    current_user
                )
            )

            tickets = list(
                dashboard.get(
                    "all_tickets"
                )
                or []
            )

            workload = list(
                dashboard.get(
                    "officer_workload"
                )
                or []
            )

            backend_metrics = dict(
                dashboard.get(
                    "metrics"
                )
                or {}
            )

            metrics = _calculate_metrics(
                tickets,
                backend_metrics,
            )

            recent_tickets = sorted(
                tickets,
                key=_ticket_sort_key,
                reverse=True,
            )[:10]

            hod_name = str(
                hod["full_name"]
                or "Department HOD"
            )

            department_name = str(
                hod["department_name"]
                or "Department"
            )

            subject = (
                "SmartQuery Daily Summary — "
                f"{department_name} — "
                + generated_local.strftime(
                    "%d %b %Y"
                )
            )

            summaries.append(
                {
                    "hod_user_id":
                        hod["user_id"],
                    "to_email":
                        hod["email"],
                    "hod_name":
                        hod_name,
                    "department_name":
                        department_name,
                    "generated_at":
                        generated_at.isoformat(),
                    "generated_at_local":
                        generated_text,
                    "subject":
                        subject,
                    "text_body":
                        _build_text_body(
                            hod_name=hod_name,
                            department_name=(
                                department_name
                            ),
                            generated_text=(
                                generated_text
                            ),
                            metrics=metrics,
                            workload=workload,
                            recent_tickets=(
                                recent_tickets
                            ),
                        ),
                    "html_body":
                        _build_html_body(
                            hod_name=hod_name,
                            department_name=(
                                department_name
                            ),
                            generated_text=(
                                generated_text
                            ),
                            metrics=metrics,
                            workload=workload,
                            recent_tickets=(
                                recent_tickets
                            ),
                        ),
                    "metrics":
                        metrics,
                }
            )

        return {
            "generated_at":
                generated_at.isoformat(),
            "count":
                len(summaries),
            "summaries":
                summaries,
        }

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Daily HOD summary data "
                "could not be loaded."
            ),
        ) from exc
