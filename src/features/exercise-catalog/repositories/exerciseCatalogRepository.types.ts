import type { Unsubscribe } from "firebase/firestore";
import type { AppId } from "../../../types/brandedIds";
import type { ExerciseCatalogFormValues, ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

export interface ExerciseCatalogRepository {
  subscribeCatalog: (
    appId: AppId,
    callback: (items: ExerciseCatalogItem[]) => void,
    onError: (message: string) => void,
  ) => Unsubscribe;
  getExercise: (appId: AppId, exerciseId: string) => Promise<ExerciseCatalogItem | null>;
  createExercise: (appId: AppId, values: ExerciseCatalogFormValues) => Promise<string>;
  updateExercise: (appId: AppId, exerciseId: string, values: ExerciseCatalogFormValues) => Promise<void>;
  archiveExercise: (appId: AppId, exerciseId: string) => Promise<void>;
  restoreExercise: (appId: AppId, exerciseId: string) => Promise<void>;
}
