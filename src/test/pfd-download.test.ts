import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadDocument, previewDocument } from "@/lib/api";

const SESSION_ID = "session-pfd-1";
const MERMAID_CODE = "flowchart TD\nA[Start] --> B[Done]";

function mockSessionFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes(`/api/sessions/${SESSION_ID}`) && !url.includes("/outputs/")) {
      return new Response(
        JSON.stringify({
          id: SESSION_ID,
          module_type: "pfd",
          status: "completed",
          created_at: "2026-07-27T00:00:00.000Z",
          metadata: {},
          outputs: [
            {
              output_type: "pfd_mermaid",
              storage_path: "",
              mermaid_code: MERMAID_CODE,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Any other path - especially the storage-backed download endpoint - must
    // never be hit for a pfd_mermaid output, since it never has a stored file.
    throw new Error(`Unexpected fetch to ${url}`);
  });
}

describe("PFD download/preview (no storage file exists for pfd_mermaid)", () => {
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let originalBlob: typeof Blob;
  let blobSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal("fetch", mockSessionFetch());
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
    URL.revokeObjectURL = vi.fn();

    // jsdom's Blob/Response don't round-trip text content reliably in this
    // environment, so verify what was actually handed to the Blob constructor
    // instead of trying to read it back out of a constructed Blob.
    originalBlob = globalThis.Blob;
    blobSpy = vi.fn((parts: BlobPart[], options?: BlobPropertyBag) => new originalBlob(parts, options));
    vi.stubGlobal("Blob", blobSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it("downloads the raw mermaid source as a .mmd file instead of calling the storage endpoint", async () => {
    const clickSpy = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = clickSpy;
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(anchor);

    await downloadDocument(SESSION_ID, "pfd_mermaid");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(anchor.download).toBe("process-flow-diagram.mmd");
    expect(blobSpy).toHaveBeenCalledWith([MERMAID_CODE], { type: "text/plain" });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("previews the raw mermaid source in a new tab instead of calling the storage endpoint", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);

    await previewDocument(SESSION_ID, "pfd_mermaid");

    expect(openSpy).toHaveBeenCalledWith("blob:mock-url", "_blank", "noreferrer,noopener");
    expect(blobSpy).toHaveBeenCalledWith([MERMAID_CODE], { type: "text/plain" });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
