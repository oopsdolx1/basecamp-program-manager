import { routes, type AppRoute } from "./routes";

export const routeBuilder = {
  home: (): AppRoute => routes.home,
  print: (): AppRoute => routes.print,
  quickPrint: (): AppRoute => routes.quickPrint,
  master: (tab?: "programs" | "history"): string => (tab ? `${routes.master}?tab=${tab}` : routes.master),
  programs: (): AppRoute => routes.programs,
  exerciseCatalog: (): AppRoute => routes.exerciseCatalog,
  newProgram: (): AppRoute => routes.newProgram,
  programDetail: (id: string): string => `/program-manager/programs/${id}`,
  editProgram: (id: string): string => `/program-manager/programs/${id}/edit`,
  printPreview: (programId: string, memberId: string): string =>
    `/program-manager/print/${programId}?memberId=${memberId}`,
  printHistory: (filters?: { memberId?: string; programId?: string; category?: string; search?: string }): string => {
    const params = new URLSearchParams();
    params.set("tab", "history");
    if (filters?.memberId) params.set("memberId", filters.memberId);
    if (filters?.programId) params.set("programId", filters.programId);
    if (filters?.category && filters.category !== "ALL") params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    return `${routes.master}?${params.toString()}`;
  },
  settings: (): AppRoute => routes.settings,
};
