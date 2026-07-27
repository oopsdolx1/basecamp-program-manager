export const routes = {
  home: "/",
  quickPrint: "/program-manager/quick-print",
  programs: "/program-manager/programs",
  exerciseCatalog: "/program-manager/exercise-catalog",
  newProgram: "/program-manager/programs/new",
  programDetail: "/program-manager/programs/:id",
  editProgram: "/program-manager/programs/:id/edit",
  printPreview: "/program-manager/print/:programId",
  printHistory: "/program-manager/print-history",
  settings: "/program-manager/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
