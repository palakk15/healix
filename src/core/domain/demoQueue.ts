export interface DemoDoctor {
  id: string;
  name: string;
  specialty: "gastro" | "cardio" | "general";
  prefix: string;
  now: number;
  waiting: number;
  minutesPerPatient: number;
}

export interface DemoQueueState {
  tick: number;
  doctors: DemoDoctor[];
}

export const alertWaitMinutes = 40;
export const travelMinutes = 7;

export const initialDemoQueue: DemoQueueState = {
  tick: 0,
  doctors: [
    { id: "gastro", name: "Dr. Meera Kulkarni", specialty: "gastro", prefix: "A", now: 17, waiting: 6, minutesPerPatient: 5.33 },
    { id: "cardio", name: "Dr. Arjun Rao", specialty: "cardio", prefix: "C", now: 9, waiting: 3, minutesPerPatient: 4.67 },
    { id: "general", name: "Dr. Fatima Shaikh", specialty: "general", prefix: "G", now: 41, waiting: 11, minutesPerPatient: 4.36 },
  ],
};

export function predictedWait(doctor: DemoDoctor): number {
  return Math.round(doctor.waiting * doctor.minutesPerPatient);
}

export function tokenLabel(doctor: DemoDoctor, number = doctor.now): string {
  return `${doctor.prefix}-${String(number).padStart(2, "0")}`;
}

export function isLongWait(doctor: DemoDoctor): boolean {
  return predictedWait(doctor) >= alertWaitMinutes;
}

export function leaveHomeMinutes(doctor: DemoDoctor): number {
  return Math.max(predictedWait(doctor) - travelMinutes, 0);
}

export function advanceDemoQueue(state: DemoQueueState): DemoQueueState {
  const calledIndex = state.tick % state.doctors.length;
  const arrivals = state.tick % 2 === 0 ? 1 : 0;
  const doctors = state.doctors.map((doctor, index) => {
    if (index !== calledIndex) return doctor;
    const waiting = Math.max(doctor.waiting - 1 + arrivals, 2);
    return { ...doctor, now: doctor.now + 1, waiting };
  });
  return { tick: state.tick + 1, doctors };
}
