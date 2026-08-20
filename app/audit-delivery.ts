import type { AuditFile } from "./audit-export";

export type AuditDeliveryResult = "shared" | "downloaded" | "cancelled";

type ShareNavigator = Pick<Navigator, "canShare" | "share">;

type DeliveryEnvironment = {
  navigator?: ShareNavigator;
  document?: Document;
  url?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
  File?: typeof File;
  schedule?: (callback: () => void, delay: number) => unknown;
};

function isAbortError(error: unknown) {
  return typeof DOMException !== "undefined" && error instanceof DOMException
    ? error.name === "AbortError"
    : Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}

export async function deliverAuditFile(
  audit: AuditFile,
  environment: DeliveryEnvironment = {},
): Promise<AuditDeliveryResult> {
  const shareNavigator = environment.navigator ?? (typeof navigator === "undefined" ? undefined : navigator);
  const FileConstructor = environment.File ?? (typeof File === "undefined" ? undefined : File);

  if (shareNavigator?.share && shareNavigator.canShare && FileConstructor) {
    const file = new FileConstructor([audit.blob], audit.filename, { type: audit.blob.type });
    const shareData: ShareData = {
      files: [file],
      title: "APU audit konverzace",
    };

    if (shareNavigator.canShare(shareData)) {
      try {
        await shareNavigator.share(shareData);
        return "shared";
      } catch (error) {
        if (isAbortError(error)) return "cancelled";
        // A failed native share falls back to a regular browser download.
      }
    }
  }

  const page = environment.document ?? (typeof document === "undefined" ? undefined : document);
  const objectUrl = environment.url ?? (typeof URL === "undefined" ? undefined : URL);
  if (!page || !objectUrl?.createObjectURL || !objectUrl.revokeObjectURL) {
    throw new Error("File delivery is not available in this browser.");
  }

  const href = objectUrl.createObjectURL(audit.blob);
  const link = page.createElement("a");
  link.href = href;
  link.download = audit.filename;
  link.rel = "noopener";
  page.body.appendChild(link);
  link.click();
  link.remove();
  const schedule = environment.schedule ?? ((callback, delay) => window.setTimeout(callback, delay));
  schedule(() => objectUrl.revokeObjectURL(href), 1000);
  return "downloaded";
}
