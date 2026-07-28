import { normalizeSearchText, normalizeText } from "../../../utils/normalizeText";
import { toExerciseCatalogOption } from "../mappers/exerciseCatalogMapper";
import type {
  ExerciseCatalogFilters,
  ExerciseCatalogFormValues,
  ExerciseCatalogItem,
  ExerciseCatalogOption,
} from "../domain/exerciseCatalog.types";

export interface ExerciseCatalogValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export const normalizeAlias = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeAliases = (_name: string, aliases: string[]): string[] => {
  const normalized = new Map<string, string>();
  aliases.forEach((value) => {
    const alias = normalizeAlias(value);
    if (!alias) return;
    normalized.set(normalizeText(alias), alias);
  });
  return [...normalized.values()];
};

export const sanitizeExerciseCatalogForm = (values: ExerciseCatalogFormValues): ExerciseCatalogFormValues => ({
  ...values,
  name: values.name.trim(),
  englishName: values.englishName.trim(),
  memo: values.memo.trim(),
  aliases: normalizeAliases(values.name, values.aliases),
});

const catalogSearchText = (item: ExerciseCatalogItem): string =>
  normalizeSearchText([item.name, item.englishName ?? "", ...item.aliases]);

const findAliasCollision = (
  aliases: string[],
  existingItems: ExerciseCatalogItem[],
  currentId?: string,
): string | null => {
  const normalizedAliases = aliases.map(normalizeText);
  const collision = existingItems.find(
    (item) =>
      item.id !== currentId &&
      item.aliases.some((alias) => normalizedAliases.includes(normalizeText(alias))),
  );
  return collision?.name ?? null;
};

export const validateExerciseCatalogForm = (
  values: ExerciseCatalogFormValues,
  existingItems: ExerciseCatalogItem[] = [],
  currentId?: string,
): ExerciseCatalogValidationResult => {
  const sanitized = sanitizeExerciseCatalogForm(values);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sanitized.name) errors.push("한글명을 입력해 주세요.");
  if (!sanitized.category) errors.push("카테고리를 선택해 주세요.");
  if (!sanitized.primaryMuscle) errors.push("주요 근육을 선택해 주세요.");
  if (!sanitized.equipmentType) errors.push("장비를 선택해 주세요.");

  const sameName = existingItems.find(
    (item) => item.id !== currentId && normalizeText(item.name) === normalizeText(sanitized.name),
  );
  if (sameName) errors.push("동일한 한글명의 운동이 이미 있습니다.");

  if (sanitized.englishName) {
    const sameEnglishName = existingItems.find(
      (item) =>
        item.id !== currentId &&
        item.englishName &&
        normalizeText(item.englishName) === normalizeText(sanitized.englishName),
    );
    if (sameEnglishName) warnings.push("동일한 영문명을 가진 운동이 있습니다. 저장은 가능합니다.");
  }

  const aliasCollision = findAliasCollision(sanitized.aliases, existingItems, currentId);
  if (aliasCollision) errors.push(`Alias가 다른 운동과 충돌합니다: ${aliasCollision}`);

  if (sanitized.aliases.length < 1) warnings.push("Alias가 없습니다.");
  if (!sanitized.englishName) warnings.push("English Name이 없습니다.");
  if (!sanitized.memo) warnings.push("Memo가 없습니다.");

  return { valid: errors.length === 0, errors, warnings };
};

export const searchExerciseCatalog = (
  items: ExerciseCatalogItem[],
  filters: ExerciseCatalogFilters,
): ExerciseCatalogItem[] => {
  const search = normalizeText(filters.search);

  return [...items]
    .filter((item) => {
      if (filters.status === "ALL") return true;
      return filters.status === "ARCHIVED" ? item.isArchived : !item.isArchived;
    })
    .filter((item) => (filters.category === "ALL" ? true : item.category === filters.category))
    .filter((item) => (filters.equipmentType === "ALL" ? true : item.equipmentType === filters.equipmentType))
    .filter((item) => (filters.primaryMuscle === "ALL" ? true : item.primaryMuscle === filters.primaryMuscle))
    .filter((item) => {
      if (filters.quality === "NO_ALIAS") return item.aliases.length === 0;
      if (filters.quality === "NO_ENGLISH_NAME") return !item.englishName;
      if (filters.quality === "NO_MEMO") return !item.memo.trim();
      return true;
    })
    .filter((item) => (search ? catalogSearchText(item).includes(search) : true))
    .sort((left, right) => {
      if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1;
      if (left.isFavorite !== right.isFavorite) return left.isFavorite ? -1 : 1;
      return left.name.localeCompare(right.name, "ko-KR", { numeric: true });
    });
};

export const toCatalogOptions = (items: ExerciseCatalogItem[]): ExerciseCatalogOption[] =>
  searchExerciseCatalog(items, {
    search: "",
    category: "ALL",
    equipmentType: "ALL",
    primaryMuscle: "ALL",
    status: "ACTIVE",
    quality: "ALL",
  }).map(toExerciseCatalogOption);
