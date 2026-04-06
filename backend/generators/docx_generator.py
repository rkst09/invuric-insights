"""
Invuric BA Agent — Document Generator
- SOW: fills the actual Invuric SOW Word template (exact branding preserved)
- PRD / FRD: built from scratch matching the SOW template's exact style
"""

import copy, os, re, shutil
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from datetime import datetime

FONT = "Neue Haas Grotesk Text Pro"
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates")

# Template-exact colours
HEX_BLACK  = "000000"   # table header fill (matches template exactly)
HEX_WHITE  = "FFFFFF"   # header text colour
HEX_LIGHT  = "F2F2F2"   # alternating data row tint
GANTT_CHAR = "\u2588\u2588\u2588\u2588\u2588\u2588"   # ██████ — Gantt bar

# Template Gantt week-range columns (1-based week numbers)
GANTT_COLS = [(1,2),(3,4),(5,6),(7,8),(9,10),(11,12),(13,16)]


# ── Low-level XML helpers ─────────────────────────────────────────────────────

def _set_cell_text(cell, text: str):
    """Set cell text, preserving existing run formatting."""
    for para in cell.paragraphs:
        if para.runs:
            para.runs[0].text = str(text)
            for r in para.runs[1:]:
                r.text = ""
            return
    if cell.paragraphs:
        cell.paragraphs[0].add_run(str(text))
    else:
        cell.add_paragraph(str(text))


def _set_para_text(para, text: str):
    """Set paragraph text, preserving run formatting of first run."""
    if para.runs:
        para.runs[0].text = str(text)
        for r in para.runs[1:]:
            r.text = ""
    else:
        para.add_run(str(text))


def _set_el_run_text(el, text: str):
    """Set text in a paragraph XML element (for cloned nodes)."""
    runs = el.findall(".//" + qn("w:r"))
    if runs:
        first = runs[0]
        for t in first.findall(qn("w:t")):
            first.remove(t)
        t_el = OxmlElement("w:t")
        t_el.text = str(text)
        first.append(t_el)
        for r in runs[1:]:
            for t in r.findall(qn("w:t")):
                r.remove(t)
    else:
        r_el = OxmlElement("w:r")
        t_el = OxmlElement("w:t")
        t_el.text = str(text)
        r_el.append(t_el)
        el.append(r_el)


def _replace_paras_with_items(paras: list, items: list):
    """Replace template list-paragraphs with AI items (handles different counts)."""
    if not paras:
        return
    items = [str(i) for i in items if i]

    ref_el = paras[0]._element
    last_el = paras[-1]._element

    for i, p in enumerate(paras):
        if i < len(items):
            _set_para_text(p, items[i])
        else:
            _set_para_text(p, "")   # blank excess template rows

    if len(items) > len(paras):
        insert_after = last_el
        for extra in items[len(paras):]:
            new_el = copy.deepcopy(ref_el)
            _set_el_run_text(new_el, extra)
            insert_after.addnext(new_el)
            insert_after = new_el


def _fill_list_group(doc, pattern: str, items: list):
    """Find paragraphs matching pattern and replace with items."""
    paras = [p for p in doc.paragraphs if re.match(pattern, p.text.strip())]
    _replace_paras_with_items(paras, items)


def _shade(cell, hex_fill: str):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    for old in tcPr.findall(qn("w:shd")):
        tcPr.remove(old)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def _borders(table, color=HEX_BLACK):
    for row in table.rows:
        for cell in row.cells:
            tc = cell._tc
            tcPr = tc.get_or_add_tcPr()
            for old in tcPr.findall(qn("w:tcBorders")):
                tcPr.remove(old)
            tcB = OxmlElement("w:tcBorders")
            for side in ("top", "left", "bottom", "right"):
                b = OxmlElement(f"w:{side}")
                b.set(qn("w:val"), "single")
                b.set(qn("w:sz"), "4")
                b.set(qn("w:space"), "0")
                b.set(qn("w:color"), color)
                tcB.append(b)
            tcPr.append(tcB)


def _hex(h: str) -> RGBColor:
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _style_run(run, size=11, bold=False, color_hex=None):
    run.font.name = FONT
    run.font.size = Pt(size)
    run.font.bold = bold
    if color_hex:
        run.font.color.rgb = _hex(color_hex)


def _header_row(table, headers, bg=HEX_BLACK, fg=HEX_WHITE, size=10):
    row = table.rows[0]
    for i, h in enumerate(headers):
        if i < len(row.cells):
            _shade(row.cells[i], bg)
            _set_cell_text(row.cells[i], h)
            for para in row.cells[i].paragraphs:
                for run in para.runs:
                    _style_run(run, size=size, bold=True, color_hex=fg)


def _set_col_widths(table, widths_in):
    for i, w in enumerate(widths_in):
        if i < len(table.columns):
            for cell in table.columns[i].cells:
                cell.width = Inches(w)


# ── Week helpers ──────────────────────────────────────────────────────────────

def _parse_week_nums(weeks_str: str, idx: int, total: int):
    """Return (start_week, end_week) 1-based from a string like '1-2' or 'Week 3-4'."""
    if weeks_str:
        nums = re.findall(r"\d+", str(weeks_str))
        if len(nums) >= 2:
            return int(nums[0]), int(nums[1])
        if len(nums) == 1:
            w = int(nums[0])
            return w, w + 1
    # Evenly distribute across 16 weeks
    chunk = 16 / total
    return int(idx * chunk) + 1, int((idx + 1) * chunk)


def _weeks_overlap(s1, e1, s2, e2) -> bool:
    return s1 <= e2 and s2 <= e1


# ═══════════════════════════════════════════════════════════════════════════════
#  SOW — template-copy approach
# ═══════════════════════════════════════════════════════════════════════════════

def _sow_from_template(content: dict, output_path: str):
    template_path = os.path.join(TEMPLATES_DIR, "invuric_sow.docx")
    shutil.copy2(template_path, output_path)
    doc = Document(output_path)
    metadata = content.get("metadata", {})

    _sow_cover(doc, metadata)
    _sow_metadata_table(doc, metadata)
    _sow_overview(doc, content)
    _sow_scope(doc, content)
    _sow_raid(doc, content)
    _sow_responsibilities(doc, content)
    _sow_gantt(doc, content)
    _sow_roles(doc, content)
    _sow_deliverables(doc, content)
    _sow_signature(doc, metadata)

    doc.save(output_path)


def _sow_cover(doc, metadata):
    """Update client name and date in the cover page table cell."""
    tbl = doc.tables[0]
    cover_cell = tbl.rows[0].cells[2]
    client = metadata.get("client_name", "")
    today  = datetime.utcnow().strftime("%d %B %Y")

    # Para[4] has runs: br, "Prepared for", br, br, "Client Name", br, br, "Prepared by"
    # Replace the run whose text is exactly "Client Name"
    for para in cover_cell.paragraphs:
        for run in para.runs:
            if run.text.strip() == "Client Name":
                run.text = client
            elif "[Date]" in run.text:
                run.text = today


def _sow_metadata_table(doc, metadata):
    tbl = doc.tables[1]
    today = datetime.utcnow().strftime("%d/%m/%Y")
    # row 0: Project Id | <ID> | Name of the Project | <Name>
    _set_cell_text(tbl.rows[0].cells[1], metadata.get("project_id", ""))
    _set_cell_text(tbl.rows[0].cells[3], metadata.get("project_name", ""))
    # row 1: Author | <Author> | SOW Requestor | <Requestor>
    _set_cell_text(tbl.rows[1].cells[1], metadata.get("author", ""))
    _set_cell_text(tbl.rows[1].cells[3], metadata.get("requestor", ""))
    # row 2: Date Created | today | Date Submitted | today
    _set_cell_text(tbl.rows[2].cells[1], today)
    _set_cell_text(tbl.rows[2].cells[3], today)
    # row 3: Estimated Start | <start> | Estimated End | <end>
    if len(tbl.rows) > 3:
        _set_cell_text(tbl.rows[3].cells[1], metadata.get("start_date", ""))
        _set_cell_text(tbl.rows[3].cells[3], metadata.get("end_date", ""))


def _sow_overview(doc, content):
    overview = content.get("project_overview", content.get("executive_summary", ""))
    for p in doc.paragraphs:
        if "<Overview Description>" in p.text:
            _set_para_text(p, overview)
            break


def _sow_scope(doc, content):
    scope = content.get("scope_of_work", {})
    in_s  = scope.get("in_scope", [])  if isinstance(scope, dict) else []
    out_s = scope.get("out_of_scope", []) if isinstance(scope, dict) else []
    _fill_list_group(doc, r"^In Scope Item \d+$", in_s)
    _fill_list_group(doc, r"^Out of Scope Item \d+$", out_s)


def _sow_raid(doc, content):
    def _fill_raid_tbl(tbl, items):
        if not items:
            return
        ref_tr = tbl.rows[1]._tr if len(tbl.rows) > 1 else None
        # Remove existing data rows
        for row in list(tbl.rows)[1:]:
            tbl._tbl.remove(row._tr)
        # Add rows from AI content
        for i, item in enumerate(items):
            new_tr = copy.deepcopy(ref_tr) if ref_tr is not None else None
            if new_tr is None:
                break
            tbl._tbl.append(new_tr)
            row = tbl.rows[-1]
            if isinstance(item, dict):
                _set_cell_text(row.cells[0], item.get("id", f"R-{i+1:03d}"))
                _set_cell_text(row.cells[1], item.get("description", ""))
            else:
                _set_cell_text(row.cells[0], f"R-{i+1:03d}")
                _set_cell_text(row.cells[1], str(item))

    _fill_raid_tbl(doc.tables[2], content.get("risks", []))
    _fill_raid_tbl(doc.tables[3], content.get("assumptions", []))
    _fill_raid_tbl(doc.tables[4], content.get("dependencies", []))


def _sow_responsibilities(doc, content):
    resp = content.get("responsibilities", {})
    invuric_items, client_items = [], []

    if isinstance(resp, dict):
        for k, v in resp.items():
            items = v if isinstance(v, list) else [str(v)]
            if any(x in k.lower() for x in ("invuric", "provider", "vendor")):
                invuric_items = [str(i) for i in items]
            elif "client" in k.lower():
                client_items = [str(i) for i in items]

    # Locate the two groups by their position relative to headings
    in_invuric = in_client = False
    inv_paras, cli_paras = [], []

    for p in doc.paragraphs:
        txt = p.text.strip()
        if "4.1" in txt or ("PROVIDER" in txt.upper() and "RESPONSIB" in txt.upper()):
            in_invuric, in_client = True, False
        elif "4.2" in txt or ("CLIENT" in txt.upper() and "RESPONSIB" in txt.upper()):
            in_invuric, in_client = False, True
        elif re.match(r"^(PROJECT EXECUTION|ROLES|DELIVERABLES|ENGAGEMENT)", txt.upper()):
            in_invuric = in_client = False
        elif re.match(r"^Responsibility Item \d+$", txt):
            if in_invuric:
                inv_paras.append(p)
            elif in_client:
                cli_paras.append(p)

    _replace_paras_with_items(inv_paras, invuric_items)
    _replace_paras_with_items(cli_paras, client_items)


def _sow_gantt(doc, content):
    timeline = content.get("timeline", {})
    phases   = timeline.get("phases", []) if isinstance(timeline, dict) else \
               (timeline if isinstance(timeline, list) else [])

    tbl = doc.tables[5]  # Gantt is Table 5

    for row_idx in range(1, len(tbl.rows)):
        row = tbl.rows[row_idx]
        pi  = row_idx - 1

        if pi < len(phases):
            phase = phases[pi]
            name  = phase.get("phase", phase.get("name", f"Phase {pi+1}"))
            weeks = phase.get("weeks", phase.get("week_range", ""))
            sw, ew = _parse_week_nums(weeks, pi, len(phases))

            _set_cell_text(row.cells[0], name)
            for ci, (cs, ce) in enumerate(GANTT_COLS):
                cell = row.cells[ci + 1]
                if _weeks_overlap(sw, ew, cs, ce):
                    _set_cell_text(cell, GANTT_CHAR)
                else:
                    _set_cell_text(cell, "")
        else:
            for cell in row.cells:
                _set_cell_text(cell, "")


def _sow_roles(doc, content):
    roles = content.get("roles", [])
    tbl   = doc.tables[6]

    for row_idx in range(1, len(tbl.rows)):
        row = tbl.rows[row_idx]
        ri  = row_idx - 1

        if ri < len(roles):
            role = roles[ri]
            if isinstance(role, dict):
                _set_cell_text(row.cells[0], role.get("role", ""))
                _set_cell_text(row.cells[1], role.get("description", ""))
                _set_cell_text(row.cells[2], role.get("location", ""))
                _set_cell_text(row.cells[3], "")               # Rate — blank
                _set_cell_text(row.cells[4], "")               # M1 hours
                _set_cell_text(row.cells[5], "")               # M2 hours
                _set_cell_text(row.cells[6], "")               # M3 hours
                _set_cell_text(row.cells[7], role.get("hours", ""))
                _set_cell_text(row.cells[8], "")               # Cost — blank
        else:
            for cell in row.cells:
                _set_cell_text(cell, "")


def _sow_deliverables(doc, content):
    deliverables = content.get("deliverables", [])
    acceptance   = content.get("acceptance_criteria", [])

    if isinstance(deliverables[0], dict) if deliverables else False:
        names = [d.get("name", d.get("description", str(d))) for d in deliverables]
    else:
        names = [str(d) for d in deliverables]

    _fill_list_group(doc, r"^Deliverable \d+$", names)

    if isinstance(acceptance, list):
        _fill_list_group(doc, r"^Acceptance Criterion \d+$", [str(a) for a in acceptance])
    elif isinstance(acceptance, str):
        _fill_list_group(doc, r"^Acceptance Criterion \d+$", [acceptance])


def _sow_signature(doc, metadata):
    tbl    = doc.tables[9]
    client = metadata.get("client_name", "")
    if client and len(tbl.rows) > 0 and len(tbl.rows[0].cells) > 1:
        _set_cell_text(tbl.rows[0].cells[1], client.upper())


# ═══════════════════════════════════════════════════════════════════════════════
#  Shared scratch-build helpers (PRD / FRD — match SOW template visual style)
# ═══════════════════════════════════════════════════════════════════════════════

def _setup_page(doc):
    sec = doc.sections[0]
    sec.page_width    = Inches(8.5)
    sec.page_height   = Inches(11)
    sec.left_margin   = Inches(1.0)
    sec.right_margin  = Inches(1.0)
    sec.top_margin    = Inches(1.0)
    sec.bottom_margin = Inches(1.0)
    norm = doc.styles["Normal"]
    norm.font.name = FONT
    norm.font.size = Pt(11)


def _footer(doc, doc_type: str):
    for sec in doc.sections:
        fp = sec.footer.paragraphs[0]
        fp.clear()
        run = fp.add_run(
            f"Invuric  ·  {doc_type}  ·  {datetime.utcnow().strftime('%B %Y')}  ·  CONFIDENTIAL"
        )
        _style_run(run, size=8, color_hex="888888")
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER


def _cover(doc, title: str, metadata: dict):
    """Black cover block matching SOW template aesthetic."""
    tbl = doc.add_table(rows=3, cols=1)
    tbl.style = "Table Grid"

    # Logo area (blank — black fill matching template)
    r0 = tbl.rows[0].cells[0]
    _shade(r0, HEX_BLACK)
    _set_cell_text(r0, "")
    r0.height = Inches(1.4)

    # Document title
    r1 = tbl.rows[1].cells[0]
    _shade(r1, HEX_BLACK)
    p1 = r1.paragraphs[0]
    p1.clear()
    p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p1.add_run(title)
    _style_run(run, size=26, bold=True, color_hex=HEX_WHITE)
    p1.paragraph_format.space_before = Pt(12)
    p1.paragraph_format.space_after  = Pt(12)

    # Prepared for
    r2 = tbl.rows[2].cells[0]
    _shade(r2, HEX_BLACK)
    p2 = r2.paragraphs[0]
    p2.clear()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    client = metadata.get("client_name", "")
    run2 = p2.add_run(f"Prepared for: {client}" if client else "Prepared for:")
    _style_run(run2, size=13, color_hex=HEX_WHITE)
    p2.paragraph_format.space_before = Pt(8)
    p2.paragraph_format.space_after  = Pt(8)


def _metadata_table(doc, metadata: dict, req_label="Requestor"):
    """4×4 metadata table matching SOW template layout."""
    tbl = doc.add_table(rows=4, cols=4)
    tbl.style = "Table Grid"
    _borders(tbl, "000000")

    rows_data = [
        ("Project Id",       metadata.get("project_id", ""),
         "Name of the Project", metadata.get("project_name", "")),
        ("Author",           metadata.get("author", ""),
         req_label,          metadata.get("requestor", "")),
        ("Date Created",     datetime.utcnow().strftime("%d/%m/%Y"),
         "Date Submitted",   datetime.utcnow().strftime("%d/%m/%Y")),
        ("Estimated Start Date", metadata.get("start_date", ""),
         "Estimated End Date",   metadata.get("end_date", "")),
    ]

    for ri, (l1, v1, l2, v2) in enumerate(rows_data):
        row = tbl.rows[ri]
        # Label cells — black fill
        _shade(row.cells[0], HEX_BLACK)
        _set_cell_text(row.cells[0], l1)
        for para in row.cells[0].paragraphs:
            for run in para.runs:
                _style_run(run, size=10, bold=True, color_hex=HEX_WHITE)

        _shade(row.cells[2], HEX_BLACK)
        _set_cell_text(row.cells[2], l2)
        for para in row.cells[2].paragraphs:
            for run in para.runs:
                _style_run(run, size=10, bold=True, color_hex=HEX_WHITE)

        # Value cells
        _set_cell_text(row.cells[1], v1)
        _set_cell_text(row.cells[3], v2)
        for ci in (1, 3):
            for para in row.cells[ci].paragraphs:
                for run in para.runs:
                    _style_run(run, size=10)


def _section_heading(doc, text: str, number: str = ""):
    """Matches template's List Paragraph 20pt heading style."""
    p = doc.add_paragraph()
    p.style = doc.styles["Normal"]
    label = f"{number}. {text}" if number else text
    run = p.add_run(label.upper())
    _style_run(run, size=20, bold=False)
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after  = Pt(4)
    # Black bottom rule (matching template horizontal divider)
    pPr  = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bot  = OxmlElement("w:bottom")
    bot.set(qn("w:val"),   "single")
    bot.set(qn("w:sz"),    "6")
    bot.set(qn("w:space"), "1")
    bot.set(qn("w:color"), HEX_BLACK)
    pBdr.append(bot)
    pPr.append(pBdr)


def _sub_heading(doc, text: str):
    """Matches template Heading 3 sub-heading (14pt)."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    _style_run(run, size=14, bold=False)
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after  = Pt(4)


def _body(doc, text: str):
    p = doc.add_paragraph()
    run = p.add_run(str(text))
    _style_run(run, size=11)
    p.paragraph_format.space_after = Pt(6)


def _bullet_list(doc, items):
    for item in (items if isinstance(items, list) else [items]):
        p = doc.add_paragraph(style="List Bullet")
        run = p.add_run(str(item))
        _style_run(run, size=11)
        p.paragraph_format.space_after = Pt(3)


def _scratch_table(doc, headers, rows_data, col_widths=None):
    """Build a table from scratch matching template's black-header style."""
    tbl = doc.add_table(rows=1 + len(rows_data), cols=len(headers))
    tbl.style = "Table Grid"
    _header_row(tbl, headers)

    for ri, row_vals in enumerate(rows_data):
        row = tbl.rows[ri + 1]
        for ci, val in enumerate(row_vals):
            if ci < len(row.cells):
                _set_cell_text(row.cells[ci], str(val) if val is not None else "")
                for para in row.cells[ci].paragraphs:
                    for run in para.runs:
                        _style_run(run, size=10)
        # Alternate row tint
        if ri % 2 == 1:
            for cell in row.cells:
                _shade(cell, HEX_LIGHT)

    _borders(tbl, "000000")
    if col_widths:
        _set_col_widths(tbl, col_widths)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return tbl


def _render(doc, val):
    if not val:
        return
    if isinstance(val, str):
        _body(doc, val)
    elif isinstance(val, list):
        for item in val:
            if isinstance(item, dict):
                for k, v in item.items():
                    p = doc.add_paragraph()
                    r1 = p.add_run(f"{k.replace('_',' ').title()}: ")
                    _style_run(r1, size=11, bold=True)
                    r2 = p.add_run(str(v))
                    _style_run(r2, size=11)
                    p.paragraph_format.space_after = Pt(3)
            else:
                p = doc.add_paragraph(style="List Bullet")
                run = p.add_run(str(item))
                _style_run(run, size=11)
                p.paragraph_format.space_after = Pt(3)
    elif isinstance(val, dict):
        for k, v in val.items():
            _sub_heading(doc, k.replace("_", " ").title())
            _render(doc, v)
    else:
        _body(doc, str(val))


def _signature_table(doc, metadata: dict):
    client = metadata.get("client_name", "Client")
    rows = [
        ("Name", "", "Janardan Singh"),
        ("Signature", "", ""),
        ("Date", "", ""),
    ]
    tbl = doc.add_table(rows=4, cols=3)
    tbl.style = "Table Grid"
    _header_row(tbl, ["", f"{client.upper()}", "INVURIC"])
    for ri, (lbl, cv, iv) in enumerate(rows):
        row = tbl.rows[ri + 1]
        _set_cell_text(row.cells[0], lbl)
        _set_cell_text(row.cells[1], cv)
        _set_cell_text(row.cells[2], iv)
        if ri == 1:
            row.height = Inches(0.8)
    _borders(tbl, "000000")
    _set_col_widths(tbl, [1.0, 2.75, 2.75])


# ═══════════════════════════════════════════════════════════════════════════════
#  PRD — from scratch, matching SOW template style
# ═══════════════════════════════════════════════════════════════════════════════

def _build_prd(doc, content: dict, metadata: dict):
    _cover(doc, "PRODUCT REQUIREMENTS DOCUMENT", metadata)
    doc.add_page_break()
    _metadata_table(doc, metadata, req_label="Product Owner")
    doc.add_paragraph()

    # 1. Product Overview
    _section_heading(doc, "Product Overview", "1")
    _render(doc, content.get("product_overview", ""))

    # 2. Goals & Success Metrics
    _section_heading(doc, "Goals and Success Metrics", "2")
    goals = content.get("goals", [])
    if goals and isinstance(goals[0], dict):
        _scratch_table(doc,
            ["Goal", "Success Metric"],
            [[g.get("goal",""), g.get("metric","")] for g in goals],
            [3.5, 3.0])
    else:
        _render(doc, goals)

    # 3. User Personas
    _section_heading(doc, "User Personas", "3")
    personas = content.get("user_personas", [])
    if personas and isinstance(personas[0], dict):
        _scratch_table(doc,
            ["Persona", "Role", "Needs", "Pain Points"],
            [[p.get("name",""), p.get("role",""), p.get("needs",""), p.get("pain_points","")] for p in personas],
            [1.3, 1.3, 2.0, 1.9])
    else:
        _render(doc, personas)

    # 4. Feature Requirements
    _section_heading(doc, "Feature Requirements", "4")
    features = content.get("feature_requirements", [])
    if features and isinstance(features[0], dict):
        _scratch_table(doc,
            ["ID", "Feature", "Description", "Priority", "User Story"],
            [[f.get("id",""), f.get("feature",""), f.get("description",""),
              f.get("priority",""), f.get("user_story","")] for f in features],
            [0.6, 1.3, 1.9, 0.7, 2.0])
    else:
        _render(doc, features)

    # 5. Non-Functional Requirements
    _section_heading(doc, "Non-Functional Requirements", "5")
    nfr = content.get("non_functional_requirements", [])
    if nfr and isinstance(nfr[0], dict):
        _scratch_table(doc,
            ["Category", "Requirement"],
            [[r.get("category",""), r.get("requirement","")] for r in nfr],
            [1.6, 4.9])
    else:
        _render(doc, nfr)

    # 6-10
    for num, title, key in [
        ("6",  "User Flows",            "user_flows"),
        ("7",  "Technical Constraints", "technical_constraints"),
        ("8",  "Out of Scope",          "out_of_scope"),
        ("9",  "Timeline",              "timeline"),
        ("10", "Open Questions",        "open_questions"),
    ]:
        _section_heading(doc, title, num)
        _render(doc, content.get(key, ""))

    # Signature
    doc.add_page_break()
    _section_heading(doc, "Approval and Sign-off", "11")
    _signature_table(doc, metadata)


# ═══════════════════════════════════════════════════════════════════════════════
#  FRD — from scratch, matching SOW template style
# ═══════════════════════════════════════════════════════════════════════════════

def _build_frd(doc, content: dict, metadata: dict):
    _cover(doc, "FUNCTIONAL REQUIREMENTS DOCUMENT", metadata)
    doc.add_page_break()
    _metadata_table(doc, metadata, req_label="FRD Requestor")
    doc.add_paragraph()

    # 1. Introduction
    _section_heading(doc, "Introduction and Purpose", "1")
    _render(doc, content.get("introduction", content.get("introduction_and_purpose", "")))

    # 2. System Overview
    _section_heading(doc, "System Overview", "2")
    _render(doc, content.get("system_overview", ""))

    # 3. Functional Requirements — main table
    _section_heading(doc, "Functional Requirements", "3")
    frs = content.get("functional_requirements", [])
    if frs and isinstance(frs[0], dict):
        _scratch_table(doc,
            ["ID", "Title", "Description", "Priority", "Acceptance Criteria"],
            [[fr.get("id",""), fr.get("title",""), fr.get("description",""),
              fr.get("priority",""), fr.get("acceptance_criteria","")] for fr in frs],
            [0.65, 1.25, 1.95, 0.75, 1.9])
    else:
        _render(doc, frs)

    # 4. Business Rules
    _section_heading(doc, "Business Rules", "4")
    biz = content.get("business_rules", [])
    if biz and isinstance(biz, list):
        _scratch_table(doc,
            ["ID", "Business Rule"],
            [[f"BR-{i+1:03d}", str(r)] for i, r in enumerate(biz)],
            [1.0, 5.5])
    else:
        _render(doc, biz)

    # 5. Data Requirements
    _section_heading(doc, "Data Requirements", "5")
    _render(doc, content.get("data_requirements", ""))

    # 6. Integration Requirements
    _section_heading(doc, "Integration Requirements", "6")
    integ = content.get("integration_requirements", [])
    if integ and isinstance(integ[0], dict):
        _scratch_table(doc,
            ["System", "Integration Type", "Description"],
            [[i.get("system",""), i.get("type",""), i.get("description","")] for i in integ],
            [1.5, 1.5, 3.5])
    else:
        _render(doc, integ)

    # 7-10
    for num, title, key in [
        ("7",  "Security Requirements",  "security_requirements"),
        ("8",  "Reporting Requirements", "reporting_requirements"),
        ("9",  "Assumptions",            "assumptions"),
        ("10", "Glossary",               "glossary"),
    ]:
        _section_heading(doc, title, num)
        _render(doc, content.get(key, ""))

    # Signature
    doc.add_page_break()
    _section_heading(doc, "Approval and Sign-off", "11")
    _signature_table(doc, metadata)


# ═══════════════════════════════════════════════════════════════════════════════
#  Public entry point
# ═══════════════════════════════════════════════════════════════════════════════

def generate_docx(content: dict, output_path: str, doc_type: str = "SOW"):
    if doc_type == "SOW":
        _sow_from_template(content, output_path)
    else:
        doc = Document()
        _setup_page(doc)
        metadata = content.get("metadata", {})
        if doc_type == "PRD":
            _build_prd(doc, content, metadata)
        elif doc_type == "FRD":
            _build_frd(doc, content, metadata)
        _footer(doc, doc_type)
        doc.save(output_path)
