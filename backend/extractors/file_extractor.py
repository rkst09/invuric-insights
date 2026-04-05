import io
import pdfplumber
from docx import Document


def extract_text(content: bytes, content_type: str, filename: str) -> str:
    if content_type == "application/pdf":
        return _extract_pdf(content)
    if content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx(content)
    if content_type in ("image/png", "image/jpeg", "image/jpg"):
        return f"[Image file: {filename}]"
    return content.decode("utf-8", errors="ignore")


def _extract_pdf(content: bytes) -> str:
    lines = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.append(text)
    return "\n\n".join(lines)


def _extract_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
