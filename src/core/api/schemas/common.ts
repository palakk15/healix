import { z } from "zod";
import { specialties, urgencies } from "../../domain/specialty";

export const isoDateTimeSchema = z.iso.datetime();

export const specialtySchema = z.enum(specialties);

export const urgencySchema = z.enum(urgencies);

export const aiEnvelopeShape = {
  language: z.string(),
  request_id: z.string().optional(),
  model: z.string().optional(),
  prompt_version: z.string().optional(),
  disclaimer: z.string().optional(),
};

export const coordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const okSchema = z.object({ ok: z.literal(true) });
