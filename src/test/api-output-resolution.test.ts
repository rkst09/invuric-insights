import { describe, expect, it } from "vitest";

import { __testing, type SessionDetail } from "@/lib/api";

describe("output resolution helpers", () => {
  it("prefers the newest output for the requested module", () => {
    const session: SessionDetail = {
      id: "session-1",
      module_type: "sow",
      status: "completed",
      created_at: "2026-04-13T10:00:00.000Z",
      metadata: {},
      outputs: [
        {
          output_type: "sow_docx",
          storage_path: "outputs/session-1/sow.docx",
          created_at: "2026-04-13T10:01:00.000Z",
        },
        {
          output_type: "sow_pdf",
          storage_path: "outputs/session-1/sow.pdf",
          created_at: "2026-04-13T10:02:00.000Z",
        },
        {
          output_type: "raid_xlsx",
          storage_path: "outputs/session-1/raid.xlsx",
          created_at: "2026-04-13T10:03:00.000Z",
        },
      ],
    };

    expect(__testing.selectBestOutput(session)?.output_type).toBe("sow_pdf");
  });

  it("falls back to any available output when the module-specific prefix is missing", () => {
    const session: SessionDetail = {
      id: "session-2",
      module_type: "unknown",
      status: "completed",
      created_at: "2026-04-13T10:00:00.000Z",
      metadata: {},
      outputs: [
        {
          output_type: "backlog_xlsx",
          storage_path: "outputs/session-2/backlog.xlsx",
          created_at: "2026-04-13T10:01:00.000Z",
        },
      ],
    };

    expect(__testing.selectBestOutput(session, "custom-module")?.output_type).toBe("backlog_xlsx");
  });

  it("maps generated output types to the expected file extensions", () => {
    expect(__testing.getOutputExtension("sow_docx")).toBe("docx");
    expect(__testing.getOutputExtension("sow_pdf")).toBe("pdf");
    expect(__testing.getOutputExtension("wbs_xlsx")).toBe("xlsx");
    expect(__testing.getOutputExtension("pfd_mermaid")).toBe("mmd");
  });
});
