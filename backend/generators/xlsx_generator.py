from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# ── Shared helpers ────────────────────────────────────────────────────────────

DARK_FILL = PatternFill("solid", fgColor="1a1a2e")
ACCENT_FILL = PatternFill("solid", fgColor="6366f1")
LIGHT_FILL = PatternFill("solid", fgColor="f4f4f8")
WHITE_FONT = Font(name="Calibri", color="FFFFFF", bold=True, size=11)
HEADER_FONT = Font(name="Calibri", bold=True, size=10)
BODY_FONT = Font(name="Calibri", size=10)
THIN_BORDER = Border(
    left=Side(style="thin", color="e2e8f0"),
    right=Side(style="thin", color="e2e8f0"),
    top=Side(style="thin", color="e2e8f0"),
    bottom=Side(style="thin", color="e2e8f0"),
)

IMPACT_COLORS = {
    "High": "ef4444",
    "Critical": "ef4444",
    "Medium": "f59e0b",
    "Low": "22c55e",
    "Internal": "6366f1",
    "External": "f59e0b",
}


def _write_header_row(ws, columns: list[str], row: int = 1):
    for col, label in enumerate(columns, 1):
        cell = ws.cell(row=row, column=col, value=label)
        cell.font = WHITE_FONT
        cell.fill = ACCENT_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
    ws.row_dimensions[row].height = 22


def _write_cell(ws, row: int, col: int, value, fill=None):
    cell = ws.cell(row=row, column=col, value=value)
    cell.font = BODY_FONT
    cell.alignment = Alignment(vertical="top", wrap_text=True)
    cell.border = THIN_BORDER
    if fill:
        cell.fill = PatternFill("solid", fgColor=fill)
    return cell


def _auto_width(ws, min_w=12, max_w=40):
    for col in ws.columns:
        length = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(length, min_w), max_w)


# ── RAID ──────────────────────────────────────────────────────────────────────

RAID_TABS = {
    "risks":        ["ID", "Title", "Description", "Probability", "Impact", "Mitigation", "Owner"],
    "assumptions":  ["ID", "Title", "Description", "Impact if Wrong", "Validation Method"],
    "issues":       ["ID", "Title", "Description", "Severity", "Resolution", "Owner"],
    "dependencies": ["ID", "Title", "Description", "Type", "Due Date", "Owner"],
}

RAID_FIELD_MAP = {
    "risks":        ["id", "title", "description", "probability", "impact", "mitigation", "owner"],
    "assumptions":  ["id", "title", "description", "impact_if_wrong", "validation_method"],
    "issues":       ["id", "title", "description", "severity", "resolution", "owner"],
    "dependencies": ["id", "title", "description", "type", "due_date", "owner"],
}


def generate_raid_xlsx(data: dict, output_path: str):
    wb = Workbook()
    wb.remove(wb.active)

    for tab_key, columns in RAID_TABS.items():
        ws = wb.create_sheet(tab_key.capitalize())
        _write_header_row(ws, columns)

        for r, item in enumerate(data.get(tab_key, []), 2):
            fields = RAID_FIELD_MAP[tab_key]
            for c, field in enumerate(fields, 1):
                val = item.get(field, "")
                color = IMPACT_COLORS.get(val) if field in ("impact", "probability", "severity", "type") else None
                _write_cell(ws, r, c, val, fill=color)

        _auto_width(ws)

    wb.save(output_path)


# ── WBS ───────────────────────────────────────────────────────────────────────

def generate_wbs_xlsx(data: dict, output_path: str, audience: list[str]):
    wb = Workbook()
    ws = wb.active
    ws.title = "WBS"

    columns = ["ID", "Phase / Task / Subtask", "Duration", "Assigned To", "Level"]
    _write_header_row(ws, columns)

    row = 2
    PHASE_FILL = PatternFill("solid", fgColor="1a1a2e")
    TASK_FILL = PatternFill("solid", fgColor="e8e8f4")

    for phase in data.get("phases", []):
        # Phase row
        for c, val in enumerate([phase["id"], phase["name"], phase.get("duration", ""), "", "Phase"], 1):
            cell = ws.cell(row=row, column=c, value=val)
            cell.font = Font(name="Calibri", bold=True, color="FFFFFF", size=10)
            cell.fill = PHASE_FILL
            cell.border = THIN_BORDER
        row += 1

        for task in phase.get("tasks", []):
            assigned = ", ".join(a for a in task.get("assigned_to", []) if a in audience or not audience)
            for c, val in enumerate([task["id"], f"  {task['name']}", task.get("duration", ""), assigned, "Task"], 1):
                cell = ws.cell(row=row, column=c, value=val)
                cell.font = HEADER_FONT
                cell.fill = TASK_FILL
                cell.border = THIN_BORDER
            row += 1

            for subtask in task.get("subtasks", []):
                s_assigned = ", ".join(a for a in subtask.get("assigned_to", []) if a in audience or not audience)
                for c, val in enumerate([subtask["id"], f"    {subtask['name']}", subtask.get("duration", ""), s_assigned, "Subtask"], 1):
                    _write_cell(ws, row, c, val)
                row += 1

    _auto_width(ws)
    wb.save(output_path)


# ── Backlog ───────────────────────────────────────────────────────────────────

BACKLOG_COLS = [
    "Page Name", "High Level Flow", "User Story", "Acceptance Criteria",
    "Data Points", "Edge Cases", "Non-Functional", "Project ID", "Project Name", "Analyzed At",
]
BACKLOG_FIELDS = [
    "page_name", "high_level_flow", "user_story", "acceptance_criteria",
    "data_points", "edge_cases", "non_functional", "project_id", "project_name", "analyzed_at",
]


def generate_backlog_xlsx(data: dict, output_path: str, project_name: str, project_id: str):
    wb = Workbook()
    ws = wb.active
    ws.title = "User Stories"

    _write_header_row(ws, BACKLOG_COLS)

    for r, story in enumerate(data.get("stories", []), 2):
        for c, field in enumerate(BACKLOG_FIELDS, 1):
            _write_cell(ws, r, c, story.get(field, ""))
        ws.row_dimensions[r].height = 60

    _auto_width(ws)
    wb.save(output_path)
