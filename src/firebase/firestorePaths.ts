import type { AppId } from "../types/brandedIds";

const requireAppId = (appId: AppId): string => {
  if (!appId.trim()) {
    throw new Error("VITE_CONDITION_LAB_APP_ID is required.");
  }

  return appId;
};

export const profilesCollectionPath = (appId: AppId): string =>
  `artifacts/${requireAppId(appId)}/public/data/profiles`;

export const programsCollectionPath = (appId: AppId): string =>
  `artifacts/${requireAppId(appId)}/public/data/programs`;

export const printHistoryCollectionPath = (appId: AppId): string =>
  `artifacts/${requireAppId(appId)}/public/data/printHistory`;

export const workoutSessionsCollectionPath = (appId: AppId): string =>
  `artifacts/${requireAppId(appId)}/public/data/workoutSessions`;


export const programManagerSettingsPath = (appId: AppId): string =>
  `artifacts/${requireAppId(appId)}/public/data/settings/programManager`;
