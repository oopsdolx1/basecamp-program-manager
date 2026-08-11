export const routes = {
  home: "/",
  print: "/program-manager/print",
  quickPrint: "/program-manager/quick-print",
  master: "/program-manager/master",
  programs: "/program-manager/programs",
  newProgram: "/program-manager/programs/new",
  programDetail: "/program-manager/programs/:id",
  editProgram: "/program-manager/programs/:id/edit",
  printPreview: "/program-manager/print/:programId",
  printHistory: "/program-manager/print-history",
  settings: "/program-manager/settings",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
