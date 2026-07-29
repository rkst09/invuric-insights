import os
import shutil
import subprocess
from pathlib import Path

from config import settings


class PdfConversionUnavailableError(RuntimeError):
    """Raised when the deployment cannot convert DOCX files to PDF."""


def get_libreoffice_binary() -> str | None:
    configured_binary = os.getenv("LIBREOFFICE_BINARY") or settings.libreoffice_binary
    if configured_binary:
        return configured_binary
    return shutil.which("libreoffice") or shutil.which("soffice")


def docx_to_pdf(docx_path: str, output_dir: str) -> str:
    """Convert DOCX to PDF using LibreOffice headless."""
    libreoffice_binary = get_libreoffice_binary()
    if not libreoffice_binary:
        raise PdfConversionUnavailableError(
            "PDF export is not available on this deployment because LibreOffice is not installed."
        )

    profile_dir = Path(output_dir) / ".libreoffice-profile"
    profile_dir.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        [
            libreoffice_binary,
            f"-env:UserInstallation={profile_dir.resolve().as_uri()}",
            "--headless",
            "--nologo",
            "--nodefault",
            "--nofirststartwizard",
            "--norestore",
            "--nolockcheck",
            "--convert-to",
            "pdf",
            "--outdir",
            output_dir,
            docx_path,
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )

    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr}")

    base = os.path.splitext(os.path.basename(docx_path))[0]
    pdf_path = os.path.join(output_dir, f"{base}.pdf")

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found after conversion: {pdf_path}")

    return pdf_path
