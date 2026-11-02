import { useRef, useState } from "react";
import { Camera, FileUp, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { consentPurposes, activeProfile } from "@core/store/session";
import { Button } from "../../components/base/Button";
import { Card } from "../../components/base/Card";
import { useReportUpload } from "../../hooks/useReportUpload";
import { grantConsents } from "../../lib/auth";
import { sessionStore, useSession } from "../../store";

const maxBytes = 50 * 1024 * 1024;
const acceptedTypes = /^(image\/(png|jpe?g|webp|gif|bmp|tiff)|application\/pdf|text\/(plain|csv|markdown)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;
const acceptedExtension = /\.(pdf|png|jpe?g|webp|gif|bmp|tiff?|txt|csv|md|docx)$/i;
const fileAccept = "image/*,application/pdf,text/plain,.txt,.docx,.pdf";

function isAccepted(file: File): boolean {
  return acceptedTypes.test(file.type) || acceptedExtension.test(file.name);
}

function failureKey(reason: string | null): string {
  if (reason === "unreadable_file" || reason === "unreadable_image") return "reports.upload.failedUnreadable";
  if (reason === "no_text_found") return "reports.upload.failedNoText";
  if (reason === "scanned_pdf") return "reports.upload.failedScanned";
  return "reports.upload.failed";
}

export default function ReportUpload() {
  const { t } = useTranslation();
  const profile = useSession((state) => activeProfile(state));
  const consented = useSession((state) => state.consents.reports);
  const upload = useReportUpload(profile?.id);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<"type" | "size" | null>(null);
  const [consentFailed, setConsentFailed] = useState(false);

  async function allowReports() {
    const granted = consentPurposes.filter((purpose) => sessionStore.getState().consents[purpose]);
    try {
      await grantConsents([...granted, "reports"]);
      setConsentFailed(false);
    } catch {
      setConsentFailed(true);
    }
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!isAccepted(file)) return setProblem("type");
    if (file.size > maxBytes) return setProblem("size");
    setProblem(null);
    void upload.start(file);
  }

  const working = upload.phase === "reading" || upload.phase === "checking";

  return (
    <main id="main" className="flex flex-col gap-5 px-5 pb-8 pt-8">
      <h1 className="type-h2">{t("reports.upload.title")}</h1>
      <p className="type-body">{t("reports.upload.body")}</p>

      {!consented ? (
        <Card className="flex flex-col gap-4 !p-6">
          <p className="type-body">{t("reports.upload.consent")}</p>
          <Button onClick={() => void allowReports()}>{t("reports.upload.allow")}</Button>
          {consentFailed ? <p role="alert" className="type-small">{t("reports.upload.consentFailed")}</p> : null}
        </Card>
      ) : working ? (
        <Card className="flex flex-col items-center gap-4 !p-8 text-center" aria-busy="true">
          <Loader2 size={32} strokeWidth={1.5} className="animate-spin text-accent motion-reduce:animate-none" aria-hidden="true" />
          <p role="status" aria-live="polite" className="type-h3">
            {upload.phase === "reading" ? t("reports.upload.reading") : t("reports.upload.checking")}
          </p>
          {upload.fileName ? <p className="type-data text-ink-3-text">{upload.fileName}</p> : null}
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 !p-6">
          {upload.phase === "failed" ? (
            <p role="alert" className="type-body">{t(failureKey(upload.reason))}</p>
          ) : null}
          {problem ? <p role="alert" className="type-body">{t(problem === "type" ? "reports.upload.badType" : "reports.upload.tooBig")}</p> : null}
          <Button onClick={() => photoInput.current?.click()}>
            <Camera size={18} strokeWidth={1.75} aria-hidden="true" />
            {t("reports.upload.takePhoto")}
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <FileUp size={18} strokeWidth={1.75} aria-hidden="true" />
            {t("reports.upload.chooseFile")}
          </Button>
          <p className="type-small">{t("reports.upload.formats")}</p>
          <input
            ref={photoInput}
            data-testid="report-photo"
            type="file"
            accept="image/*"
            capture="environment"
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            onChange={(event) => {
              onPick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={fileInput}
            data-testid="report-file"
            type="file"
            accept={fileAccept}
            tabIndex={-1}
            aria-hidden="true"
            className="hidden"
            onChange={(event) => {
              onPick(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </Card>
      )}

      <p className="type-small">{t("reports.upload.privacy")}</p>
    </main>
  );
}
