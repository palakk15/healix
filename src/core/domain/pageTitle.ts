const patientRoutes: Array<[RegExp, string]> = [
  [/^\/app\/?$/, "home"],
  [/^\/app\/welcome\/?$/, "welcome"],
  [/^\/app\/triage\/?$/, "triage"],
  [/^\/app\/doctors\/?$/, "doctors"],
  [/^\/app\/doctors\/[^/]+\/?$/, "booking"],
  [/^\/app\/token(\/[^/]+)?\/?$/, "token"],
  [/^\/app\/reports\/?$/, "reports"],
  [/^\/app\/reports\/upload\/?$/, "reportUpload"],
  [/^\/app\/reports\/[^/]+\/review\/?$/, "reportReview"],
  [/^\/app\/reports\/[^/]+\/?$/, "reportExplain"],
  [/^\/app\/assistant\/?$/, "assistant"],
  [/^\/app\/emergency\/?$/, "emergency"],
  [/^\/emergency\/?$/, "emergency"],
  [/^\/app\/community\/?$/, "community"],
  [/^\/app\/community\/[^/]+\/?$/, "communityPost"],
  [/^\/app\/settings\/?$/, "settings"],
  [/^\/hospital\/?$/, "hospitalOverview"],
  [/^\/hospital\/queues\/?$/, "hospitalQueues"],
  [/^\/hospital\/analytics\/?$/, "hospitalAnalytics"],
  [/^\/hospital\/booking-modes\/?$/, "hospitalModes"],
  [/^\/hospital\/simulator\/?$/, "hospitalSimulator"],
  [/^\/hospital\/alerts\/?$/, "hospitalAlerts"],
];

export function screenKeyFor(pathname: string): string | null {
  return patientRoutes.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}
