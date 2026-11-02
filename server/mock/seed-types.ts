import type { Specialty } from "@core/domain/specialty";

export interface SeedHospital {
  id: string;
  name: string;
  locality: string;
  lat: number;
  lng: number;
  has_emergency: boolean;
}

export interface ScheduleWindow {
  day: number;
  start: string;
  end: string;
}

export interface SeedDoctor {
  id: string;
  name: string;
  specialty: Specialty;
  qualifications: string;
  years_experience: number;
  hospital_id: string;
  languages: string[];
  fee_inr: number;
  rating: number | null;
  review_count: number;
  consult_minutes: number;
  observed_consult_minutes: number;
  popularity: number;
  schedule: ScheduleWindow[];
  on_leave: boolean;
  booking_mode: "optimistic" | "pessimistic";
  token_prefix: string;
  room: string;
  about: string;
  focus: string[];
}

export interface SeedProfile {
  id: string;
  name: string;
  relation: "self" | "mother" | "father" | "spouse" | "child" | "other";
  age: number;
  sex: "female" | "male" | "other";
  conditions: string[];
  language: string;
  elder_mode: boolean;
}

export interface SeedPatient {
  id: string;
  phone: string;
  name: string;
  language: string;
  locality: string;
  lat: number;
  lng: number;
  profiles: SeedProfile[];
}

export interface HistoryHour {
  hour: number;
  patients: number;
  actual_wait: number;
  model_prediction: number;
  simple_prediction: number;
}

export interface HistoryDay {
  date: string;
  weekday: number;
  hours: HistoryHour[];
  model_mae: number;
  simple_mae: number;
}

export interface SeedHistory {
  anchor_date: string;
  days: HistoryDay[];
  model_mae: number;
  simple_mae: number;
}
