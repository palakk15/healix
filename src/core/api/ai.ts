import { z } from "zod";
import { authHeaders } from "./config";
import { apiBase, requestJson } from "./http";
import { ApiError, networkError } from "./error";
import {
  diagnosticReportSchema,
  explainResponseSchema,
  jobResponseSchema,
  processReportResponseSchema,
  reportListItemSchema,
  triageResponseSchema,
  uploadReportResponseSchema,
  type TriageAnswerRequest,
  type TriageRequest,
} from "./schemas/ai";

export const ai = {
  triage: (request: TriageRequest) => requestJson("/ai/triage", { schema: triageResponseSchema, body: request }),
  answerTriage: (request: TriageAnswerRequest) => requestJson("/ai/triage/answer", { schema: triageResponseSchema, body: request }),
  processReport: (reportId: string) => requestJson("/ai/reports/process", { schema: processReportResponseSchema, body: { report_id: reportId } }),
  job: (jobId: string) => requestJson(`/ai/jobs/${jobId}`, { schema: jobResponseSchema }),
  explain: (reportId: string, language: string) =>
    requestJson(`/ai/reports/${reportId}/explain?language=${encodeURIComponent(language)}`, { schema: explainResponseSchema }),
};

export const reports = {
  list: (profileId?: string) =>
    requestJson(`/reports${profileId ? `?profile_id=${encodeURIComponent(profileId)}` : ""}`, {
      schema: z.object({ reports: z.array(reportListItemSchema) }),
    }).then((result) => result.reports),
  upload: (profileId: string, file: File) => {
    const form = new FormData();
    form.set("profile_id", profileId);
    form.set("file", file, file.name);
    return requestJson("/reports", { schema: uploadReportResponseSchema, form });
  },
  get: (reportId: string) => requestJson(`/reports/${reportId}`, { schema: diagnosticReportSchema }),
  confirm: (reportId: string, observations: Array<{ code: string; value: number }>) =>
    requestJson(`/reports/${reportId}/confirm`, { schema: diagnosticReportSchema, body: { observations } }),
  image: async (reportId: string): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetch(`${apiBase}/reports/${reportId}/image`, { headers: authHeaders() });
    } catch {
      throw networkError();
    }
    if (!response.ok) throw new ApiError("image_unavailable", "The report image could not be loaded", response.status >= 500, response.status, null);
    return response.blob();
  },
};
