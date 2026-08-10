import { normalizeSearchText, normalizeText } from "../../../utils/normalizeText";
import { toExerciseCatalogOption } from "../mappers/exerciseCatalogMapper";
import type { ExerciseCatalogFilters, ExerciseCatalogItem, ExerciseCatalogOption } from "../domain/exerciseCatalog.types";

const catalogSearchText = (item: ExerciseCatalogItem): string =>
  normalizeSearchText([item.name, item.englishName ?? "", ...item.aliases]);

export const searchExerciseCatalog = (items: ExerciseCatalogItem[], filters: ExerciseCatalogFilters): ExerciseCatalogItem[] => {
  const search = normalizeText(filters.search);
  return [...items]
    .filter((item) => (filters.bodyPart === "ALL" ? true : (item.bodyPart ?? item.category) === filters.bodyPart))
    .filter((item) => (filters.equipment === "ALL" ? true : (item.equipment ?? item.equipmentType) === filters.equipment))
    .filter((item) => (search ? catalogSearchText(item).includes(search) : true))
    .sort((left, right) => left.name.localeCompare(right.name, "ko-KR", { numeric: true }));
};

export const toCatalogOptions = (items: ExerciseCatalogItem[]): ExerciseCatalogOption[] =>
  items.map(toExerciseCatalogOption).sort((left, right) => left.name.localeCompare(right.name, "ko-KR", { numeric: true }));
