export type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type AppId = Brand<string, "AppId">;
export type ProfileId = Brand<string, "ProfileId">;
export type ProgramId = Brand<string, "ProgramId">;
export type PrintHistoryId = Brand<string, "PrintHistoryId">;

export const toAppId = (value: string): AppId => value as AppId;
export const toProfileId = (value: string): ProfileId => value as ProfileId;
export const toProgramId = (value: string): ProgramId => value as ProgramId;
