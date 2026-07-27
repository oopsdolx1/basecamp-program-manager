import { routes, type AppRoute } from "./routes";

export const routeBuilder = {
  home: (): AppRoute => routes.home,
  quickPrint: (): AppRoute => routes.quickPrint,
  programs: (): AppRoute => routes.programs,
  exerciseCatalog: (): AppRoute => routes.exerciseCatalog,
  newProgram: (): AppRoute => routes.newProgram,
  programDetail: (id: string): string => `/program-manager/programs/${id}`,
  editProgram: (id: string): string => `/program-manager/programs/${id}/edit`,
  printPreview: (programId: string, memberId: string): string =>
    `/program-manager/print/${programId}?memberId=${memberId}`,
  printHistory: (filters?: { memberId?: string; programId?: string; category?: string; search?: string }): string => {
    const params = new URLSearchParams();
    if (filters?.memberId) params.set("memberId", filters.memberId);
    if (filters?.programId) params.set("programId", filters.programId);
    if (filters?.category && filters.category !== "ALL") params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    const query = params.toString();
    return query ? `${routes.printHistory}?${query}` : routes.printHistory;
  },
  settings: (): AppRoute => routes.settings,
};
