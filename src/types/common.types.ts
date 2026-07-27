export type Loadable<TData> =
  | { status: "loading"; data: TData }
  | { status: "ready"; data: TData }
  | { status: "error"; data: TData; message: string };

export interface RepositoryError {
  userMessage: string;
  developerMessage: string;
}
