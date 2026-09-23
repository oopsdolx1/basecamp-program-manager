export const routes = {
  home: "/",
  dashboard: "/program-manager/dashboard",
  print: "/program-manager/print",
  quickPrint: "/program-manager/quick-print",
  master: "/program-manager/master",
  programs: "/program-manager/programs",
  newProgram: "/program-manager/programs/new",
  programDetail: "/program-manager/programs/:id",
  editProgram: "/program-manager/programs/:id/edit",
  printPreview: "/program-manager/print/:programId",
  printPreviewSession: "/program-manager/print/session/:workoutSessionId",
  printHistory: "/program-manager/print-history",
  workoutSessions: "/program-manager/workout-sessions",
  workoutSessionDetail: "/program-manager/workout-sessions/:sessionId",
  settings: "/program-manager/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
