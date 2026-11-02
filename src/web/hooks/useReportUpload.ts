import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ai, reports } from "@core/api/ai";
import { jobPollMs } from "@core/domain/reportView";

export type UploadPhase = "idle" | "reading" | "checking" | "failed";

const maxPolls = 300;

export function useReportUpload(profileId: string | undefined) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const start = useCallback(
    async (file: File) => {
      if (!profileId) return;
      setFileName(file.name);
      setReason(null);
      setPhase("reading");
      try {
        const created = await reports.upload(profileId, file);
        const job = await ai.processReport(created.report_id);
        for (let attempt = 0; attempt < maxPolls; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, jobPollMs));
          if (cancelled.current) return;
          const status = await ai.job(job.job_id);
          if (status.status === "failed") throw new Error(status.reason ?? "job_failed");
          if (status.status === "ready_for_review") {
            await queryClient.invalidateQueries({ queryKey: ["reports"] });
            navigate(`/app/reports/${status.report_id}/review`);
            return;
          }
          setPhase(status.status === "processing" ? "checking" : "reading");
        }
        throw new Error("job_timeout");
      } catch (cause) {
        if (cancelled.current) return;
        setReason(cause instanceof Error ? cause.message : null);
        setPhase("failed");
      }
    },
    [navigate, profileId, queryClient],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setFileName(null);
    setReason(null);
  }, []);

  return { phase, fileName, reason, start, reset };
}
