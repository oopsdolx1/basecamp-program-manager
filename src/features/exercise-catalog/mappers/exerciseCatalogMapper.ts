import { getEquipmentTypeLabel, getExerciseCategoryLabel } from "../constants/exerciseCatalogOptions";
import type { ExerciseCatalogItem, ExerciseCatalogOption } from "../domain/exerciseCatalog.types";

export const toExerciseCatalogOption = (item: ExerciseCatalogItem): ExerciseCatalogOption => ({
  id: item.id,
  displayName: item.name,
  name: item.name,
  englishName: item.englishName,
  category: item.category,
  categoryLabel: getExerciseCategoryLabel(item.category),
  equipmentType: item.equipmentType,
  equipmentLabel: getEquipmentTypeLabel(item.equipmentType),
  bodyPart: item.bodyPart ?? item.category,
  equipment: item.equipment ?? item.equipmentType,
  aliases: item.aliases,
});
