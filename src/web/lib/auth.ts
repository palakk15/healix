import { configureApi } from "@core/api/config";
import type { ConsentPurpose } from "@core/store/session";
import { preferencesStore, sessionStore } from "../store";

export const demoOtp = "123456";
export const demoPatientPhone = "9876500001";
export const demoStaffPhone = "9000000001";

export function wireApi(): void {
  configureApi({
    getToken: () => sessionStore.getState().accessToken ?? undefined,
    isFastDemo: () => preferencesStore.getState().fastDemo,
  });
}

async function syncConsents(): Promise<void> {
  const { backend } = await import("@core/api/backend");
  const records = await backend.consents();
  sessionStore.getState().replaceConsents(records.filter((record) => record.granted).map((record) => record.purpose));
}

export async function loginWithPhone(phone: string, otp: string): Promise<void> {
  const { backend } = await import("@core/api/backend");
  const auth = await backend.login(phone, otp);
  sessionStore.getState().startSession(auth);
  await syncConsents().catch(() => undefined);
}

export async function grantConsents(purposes: ConsentPurpose[]): Promise<void> {
  const { backend } = await import("@core/api/backend");
  sessionStore.getState().replaceConsents(purposes);
  await Promise.all(
    (["triage", "reports", "location", "voice"] as const).map((purpose) =>
      purposes.includes(purpose) ? backend.setConsent(purpose, true) : Promise.resolve(),
    ),
  );
}

export async function signInOrRegister(phone: string, otp: string): Promise<void> {
  const { backend } = await import("@core/api/backend");
  const { ApiError } = await import("@core/api/error");
  try {
    await loginWithPhone(phone, otp);
  } catch (cause) {
    if (!(cause instanceof ApiError) || cause.code !== "user_not_found") throw cause;
    const auth = await backend.register(phone, undefined, otp);
    sessionStore.getState().startSession(auth);
  }
}

const restoreTimeoutMs = 4000;

export async function restoreSession(): Promise<void> {
  if (!sessionStore.getState().accessToken) return;
  const attempt = (async () => {
    const { backend } = await import("@core/api/backend");
    const user = await backend.me();
    sessionStore.getState().restoreUser(user);
    await syncConsents().catch(() => undefined);
  })();
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("restore timed out")), restoreTimeoutMs));
  try {
    await Promise.race([attempt, timeout]);
  } catch {
    sessionStore.getState().signOut();
  }
}
