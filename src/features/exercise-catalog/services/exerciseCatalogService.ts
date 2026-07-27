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
}

export const normalizeAlias = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeAliases = (name: string, aliases: string[]): string[] => {
  const normalized = new Set<string>();
  const add = (value: string) => {
    const alias = normalizeAlias(value);
    if (alias) normalized.add(alias);
  };

  add(name);
  aliases.forEach(add);
  return [...normalized];
};

export const sanitizeExerciseCatalogForm = (values: ExerciseCatalogFormValues): ExerciseCatalogFormValues => ({
  ...values,
  name: values.name.trim(),
  englishName: values.englishName.trim(),
  memo: values.memo.trim(),
  aliases: normalizeAliases(values.name, values.aliases),
});

export const validateExerciseCatalogForm = (
  values: ExerciseCatalogFormValues,
  existingItems: ExerciseCatalogItem[] = [],
  currentId?: string,
): ExerciseCatalogValidationResult => {
  const sanitized = sanitizeExerciseCatalogForm(values);
  const errors: string[] = [];

  if (!sanitized.name) errors.push("운동명을 입력해 주세요.");
  if (!sanitized.category) errors.push("카테고리를 선택해 주세요.");
  if (!sanitized.primaryMuscle) errors.push("주요 근육을 선택해 주세요.");
  if (!sanitized.equipmentType) errors.push("장비를 선택해 주세요.");
  if (sanitized.aliases.length < 1) errors.push("Alias를 1개 이상 입력해 주세요.");
  if (!sanitized.aliases.some((alias) => normalizeText(alias) === normalizeText(sanitized.name))) {
    errors.push("운동명은 aliases에 반드시 포함되어야 합니다.");
  }

  const sameName = existingItems.find(
    (item) => item.id !== currentId && normalizeText(item.name) === normalizeText(sanitized.name),
  );
  if (sameName) errors.push("같은 이름의 운동이 이미 있습니다.");

  return { valid: errors.length === 0, errors };
};

const catalogSearchText = (item: ExerciseCatalogItem): string =>
  normalizeSearchText([item.name, item.englishName ?? "", ...item.aliases]);

export const searchExerciseCatalog = (
  items: ExerciseCatalogItem[],
  filters: ExerciseCatalogFilters,
): ExerciseCatalogItem[] => {
  const search = normalizeText(filters.search);

  return [...items]
    .filter((item) => (filters.includeArchived ? true : !item.isArchived))
    .filter((item) => (filters.category === "ALL" ? true : item.category === filters.category))
    .filter((item) => (filters.equipmentType === "ALL" ? true : item.equipmentType === filters.equipmentType))
    .filter((item) => (filters.primaryMuscle === "ALL" ? true : item.primaryMuscle === filters.primaryMuscle))
    .filter((item) => (search ? catalogSearchText(item).includes(search) : true))
    .sort((left, right) => {
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
    includeArchived: false,
  }).map(toExerciseCatalogOption);
