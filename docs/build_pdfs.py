"""Build the user guide and architecture PDFs from the Markdown in this folder."""

from __future__ import annotations

import re
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent
FONT = Path(r"C:\Windows\Fonts")
INK = (28, 21, 48)
MUTED = (109, 100, 124)
ACCENT = (124, 58, 237)
ACCENT_DARK = (91, 33, 182)
LINE = (230, 224, 240)
PAPER = (244, 241, 248)


class Guide(FPDF):
    def __init__(self) -> None:
        super().__init__(format="A4", unit="mm")
        self.add_font("Segoe", "", str(FONT / "segoeui.ttf"))
        self.add_font("Segoe", "B", str(FONT / "segoeuib.ttf"))
        self.add_font("Segoe", "I", str(FONT / "segoeuii.ttf"))
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(16, 16, 16)
        self.doc_title = "TODO API"

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Segoe", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, self.doc_title, align="L")
        self.ln(4)
        self.set_draw_color(*LINE)
        self.line(16, self.get_y(), 194, self.get_y())
        self.ln(6)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Segoe", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, str(self.page_no()), align="C")


def _inline(text: str, rich: bool = True) -> str:
    if not rich:
        text = re.sub(r"`([^`]+)`", r"\1", text)
        text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
        return text.replace("&", "&amp;").replace("<", "&lt;")
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def markdown_to_html(markdown: str, base: Path) -> list[tuple[str, str]]:
    """Split Markdown into HTML chunks and diagram markers."""
    chunks: list[tuple[str, str]] = []
    html: list[str] = []
    lines = markdown.splitlines()
    index = 0

    def flush() -> None:
        body = "\n".join(html).strip()
        html.clear()
        if body:
            chunks.append(("html", body))

    while index < len(lines):
        line = lines[index]
        marker = re.fullmatch(r"<!--\s*pdf-diagram:\s*([a-z-]+)\s*-->", line.strip())
        if marker:
            flush()
            chunks.append(("diagram", marker.group(1)))
            index += 1
            continue
        if line.startswith("```"):
            language = line[3:].strip()
            block: list[str] = []
            index += 1
            while index < len(lines) and not lines[index].startswith("```"):
                block.append(lines[index])
                index += 1
            index += 1
            if language == "mermaid":
                continue
            code = "\n".join(block).replace("&", "&amp;").replace("<", "&lt;")
            html.append(f"<pre>{code}</pre>")
            continue
        if line.startswith("|"):
            rows: list[str] = []
            while index < len(lines) and lines[index].startswith("|"):
                rows.append(lines[index])
                index += 1
            parsed = []
            for row in rows:
                cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
                if cells and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
                    continue
                parsed.append(cells)
            if not parsed:
                continue
            table = ["<table>"]
            for row_index, cells in enumerate(parsed):
                tag = "th" if row_index == 0 else "td"
                inner = "".join(f"<{tag}>{_inline(cell, rich=False)}</{tag}>" for cell in cells)
                table.append(f"<tr>{inner}</tr>")
            table.append("</table>")
            html.append("".join(table))
            continue
        image = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", line.strip())
        if image:
            path = (base / image.group(2)).resolve()
            html.append(f'<p><img src="{path.as_posix()}" width="170"/></p>')
            index += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = _inline(line[level:].strip())
            html.append(f"<h{level}>{title}</h{level}>")
            index += 1
            continue
        if line.startswith("- "):
            items = []
            while index < len(lines) and lines[index].startswith("- "):
                items.append(f"<li>{_inline(lines[index][2:].strip())}</li>")
                index += 1
            html.append("<ul>" + "".join(items) + "</ul>")
            continue
        numbered = re.match(r"^(\d+)\.\s+(.*)$", line)
        if numbered:
            items = []
            while index < len(lines):
                match = re.match(r"^(\d+)\.\s+(.*)$", lines[index])
                if not match:
                    break
                items.append(f"<p>{match.group(1)}. {_inline(match.group(2).strip())}</p>")
                index += 1
            html.append("".join(items))
            continue
        if not line.strip():
            index += 1
            continue
        paragraph = [line.strip()]
        index += 1
        while index < len(lines) and lines[index].strip() and not _starts_block(lines[index]):
            paragraph.append(lines[index].strip())
            index += 1
        html.append(f"<p>{_inline(' '.join(paragraph))}</p>")
    flush()
    return chunks


def _starts_block(line: str) -> bool:
    stripped = line.strip()
    return (
        stripped.startswith("#")
        or stripped.startswith("- ")
        or bool(re.match(r"\d+\.\s", stripped))
        or stripped.startswith("|")
        or stripped.startswith("```")
        or stripped.startswith("![")
        or stripped.startswith("<!--")
    )


def _box(pdf: Guide, x: float, y: float, w: float, h: float, title: str, subtitle: str = "") -> None:
    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.4)
    pdf.rect(x, y, w, h, style="DF")
    pdf.set_xy(x, y + 3)
    pdf.set_font("Segoe", "B", 10)
    pdf.set_text_color(*INK)
    pdf.cell(w, 5, title, align="C")
    if subtitle:
        pdf.set_xy(x, y + 8)
        pdf.set_font("Segoe", "", 8)
        pdf.set_text_color(*MUTED)
        pdf.cell(w, 4, subtitle, align="C")


def _arrow(pdf: Guide, x: float, y1: float, y2: float) -> None:
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.5)
    pdf.line(x, y1, x, y2)
    pdf.line(x, y2, x - 1.4, y2 - 2.2)
    pdf.line(x, y2, x + 1.4, y2 - 2.2)


def draw_architecture(pdf: Guide) -> None:
    if pdf.get_y() > 175:
        pdf.add_page()
    top = pdf.get_y() + 2
    center = 105
    width = 78
    left = center - width / 2
    steps = [
        ("React client", "localhost:5173"),
        ("Vite proxy", "forwards /api"),
        ("FastAPI", "routers, schemas, service"),
        ("SQLAlchemy", "models.py"),
        ("PostgreSQL", "localhost:5433"),
    ]
    y = top
    for title, subtitle in steps:
        _box(pdf, left, y, width, 14, title, subtitle)
        y += 14
        if title != "PostgreSQL":
            _arrow(pdf, center, y, y + 6)
            y += 6
    pdf.set_y(y + 4)


def draw_database(pdf: Guide) -> None:
    if pdf.get_y() > 200:
        pdf.add_page()
    top = pdf.get_y() + 2
    left = 28
    width = 154
    pdf.set_fill_color(*ACCENT_DARK)
    pdf.set_draw_color(*ACCENT_DARK)
    pdf.rect(left, top, width, 10, style="F")
    pdf.set_xy(left, top + 2)
    pdf.set_font("Segoe", "B", 11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(width, 6, "todos", align="C")
    rows = [
        ("id", "integer, primary key"),
        ("title", "varchar(200), required"),
        ("description", "text, optional"),
        ("done", "boolean, default false"),
        ("created_at", "timestamptz, UTC"),
        ("updated_at", "timestamptz, UTC"),
    ]
    y = top + 10
    for index, (name, kind) in enumerate(rows):
        pdf.set_fill_color(255, 255, 255) if index % 2 == 0 else pdf.set_fill_color(244, 248, 246)
        pdf.set_draw_color(*LINE)
        pdf.rect(left, y, width, 8, style="DF")
        pdf.set_xy(left + 4, y + 1.5)
        pdf.set_font("Segoe", "B", 9)
        pdf.set_text_color(*INK)
        pdf.cell(42, 5, name)
        pdf.set_font("Segoe", "", 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(100, 5, kind)
        y += 8
    pdf.set_y(y + 3)
    pdf.set_font("Segoe", "I", 9)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(0, 5, "Indexes: ix_todos_done, ix_todos_created_at.")


def render(pdf: Guide, markdown_path: Path) -> None:
    text = markdown_path.read_text(encoding="utf-8")
    for kind, payload in markdown_to_html(text, markdown_path.parent):
        if kind == "diagram" and payload == "architecture":
            draw_architecture(pdf)
        elif kind == "diagram" and payload == "database":
            draw_database(pdf)
        else:
            pdf.set_text_color(*INK)
            pdf.set_font("Segoe", "", 11)
            pdf.write_html(payload)


def build_one(markdown_path: Path, pdf_path: Path, title: str) -> None:
    pdf = Guide()
    pdf.doc_title = title
    pdf.add_page()
    render(pdf, markdown_path)
    pdf.output(pdf_path)


def build_combined(pdf_path: Path) -> None:
    pdf = Guide()
    pdf.doc_title = "TODO API documentation"
    pdf.add_page()
    pdf.set_fill_color(*PAPER)
    pdf.rect(0, 0, 210, 297, style="F")
    pdf.set_y(70)
    pdf.set_font("Segoe", "B", 28)
    pdf.set_text_color(*INK)
    pdf.cell(0, 14, "TODO API", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Segoe", "", 14)
    pdf.set_text_color(*ACCENT_DARK)
    pdf.cell(0, 10, "User guide and architecture", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    pdf.set_font("Segoe", "", 11)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        0,
        6,
        "How to run the app, use the task list, call the API, and how the client, API, and database fit together.",
        align="C",
    )
    pdf.add_page()
    pdf.doc_title = "TODO API user guide"
    render(pdf, ROOT / "user-guide.md")
    pdf.add_page()
    pdf.doc_title = "TODO API architecture"
    render(pdf, ROOT / "architecture.md")
    pdf.output(pdf_path)


def main() -> None:
    build_one(ROOT / "user-guide.md", ROOT / "user-guide.pdf", "TODO API user guide")
    build_one(ROOT / "architecture.md", ROOT / "architecture.pdf", "TODO API architecture")
    build_combined(ROOT / "TODO-API-documentation.pdf")
    print("Wrote user-guide.pdf, architecture.pdf, and TODO-API-documentation.pdf")


if __name__ == "__main__":
    main()
