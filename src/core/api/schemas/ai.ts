import { z } from "zod";
import { aiEnvelopeShape, specialtySchema, urgencySchema } from "./common";

export const sexSchema = z.enum(["female", "male", "other"]);

export const triageRequestSchema = z.object({
  text: z.string().min(1),
  age: z.number().int().min(0).max(120),
  sex: sexSchema,
  pregnant: z.boolean().optional(),
  conditions: z.array(z.string()).optional(),
  language: z.string().optional(),
});

export const followUpSchema = z.union([
  z.string(),
  z.object({ question: z.string(), options: z.array(z.string()).optional() }),
]);

export const triageResponseSchema = z.object({
  ...aiEnvelopeShape,
  session_id: z.string().optional(),
  specialty: specialtySchema,
  urgency: urgencySchema,
  reasoning: z.array(z.string()),
  follow_up_questions: z.array(followUpSchema),
  red_flags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const triageAnswerRequestSchema = z.object({
  session_id: z.string(),
  answers: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
});

export const processReportRequestSchema = z.object({ report_id: z.string() });

export const processReportResponseSchema = z.object({ job_id: z.string() });

export const jobStatusSchema = z.enum(["queued", "processing", "ready_for_review", "failed"]);

export const jobResponseSchema = z.object({
  status: jobStatusSchema,
  report_id: z.string(),
  job_id: z.string().optional(),
  reason: z.string().optional(),
});

export const interpretationSchema = z.enum(["low", "normal", "high", "critical"]);

export const observationSchema = z.object({
  code: z.string(),
  display: z.string(),
  value: z.number(),
  unit: z.string(),
  reference: z.object({ low: z.number().nullable(), high: z.number().nullable() }),
  interpretation: interpretationSchema,
  confidence: z.number().min(0).max(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});

export const diagnosticReportSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  lab_name: z.string(),
  report_type: z.string(),
  issued_at: z.iso.datetime(),
  status: z.enum(["uploaded", "processing", "ready_for_review", "confirmed"]),
  image_url: z.string().optional(),
  observations: z.array(observationSchema),
});

export const reportListItemSchema = z.object({
  id: z.string(),
  profile_id: z.string(),
  lab_name: z.string(),
  report_type: z.string(),
  issued_at: z.iso.datetime(),
  status: z.enum(["uploaded", "processing", "ready_for_review", "confirmed"]),
  flag_count: z.number().int().min(0),
});

export const uploadReportRequestSchema = z.object({
  profile_id: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
});

export const uploadReportResponseSchema = z.object({ report_id: z.string() });

export const confirmValuesRequestSchema = z.object({
  observations: z.array(z.object({ code: z.string(), value: z.number() })),
});

export const explainDirectionSchema = z.enum(["low", "normal", "high"]);

export const explainItemSchema = z.object({
  code: z.string(),
  meaning: z.string(),
  direction: explainDirectionSchema,
  distance: z.number(),
  history: z.array(z.object({ date: z.iso.datetime(), value: z.number() })).optional(),
});

export const explainResponseSchema = z.object({
  ...aiEnvelopeShape,
  summary: z.string(),
  items: z.array(explainItemSchema),
  doctor_questions: z.array(z.string()),
  duplicates: z.array(z.object({ code: z.string(), last_date: z.iso.datetime(), days_ago: z.number().int() })),
  seek_care_if: z.string(),
});

export const assistantChatRequestSchema = z.object({
  message: z.string().min(1),
  language: z.string().optional(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
  profile_id: z.string().optional(),
});

export const citationSchema = z.object({
  n: z.number().int().positive(),
  title: z.string(),
  section: z.string(),
  page: z.number().int().positive(),
  url: z.string(),
  year: z.number().int(),
  excerpt: z.string().optional(),
});

export const assistantTokenEventSchema = z.object({ text: z.string() });
export const assistantCitationsEventSchema = z.array(citationSchema);
export const assistantRefusalEventSchema = z.object({ message: z.string(), reason: z.string().optional() });
export const assistantDoneEventSchema = z.object({ ...aiEnvelopeShape });

export type TriageRequest = z.infer<typeof triageRequestSchema>;
export type TriageResponse = z.infer<typeof triageResponseSchema>;
export type TriageAnswerRequest = z.infer<typeof triageAnswerRequestSchema>;
export type JobResponse = z.infer<typeof jobResponseSchema>;
export type Observation = z.infer<typeof observationSchema>;
export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>;
export type ReportListItem = z.infer<typeof reportListItemSchema>;
export type ExplainResponse = z.infer<typeof explainResponseSchema>;
export type ExplainItem = z.infer<typeof explainItemSchema>;
export type AssistantChatRequest = z.infer<typeof assistantChatRequestSchema>;
export type Citation = z.infer<typeof citationSchema>;
