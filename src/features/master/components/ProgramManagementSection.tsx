import { useNavigate } from "react-router-dom";
import { toAppId, toProgramId } from "../../../types/brandedIds";
import { routeBuilder } from "../../../app/routeBuilder";
import { ProgramList } from "../../programs/components/ProgramList/ProgramList";
import { usePrograms } from "../../programs/hooks/usePrograms";
import { programToFormValues } from "../../programs/mappers/programMapper";
import { programRepository } from "../../programs/repositories/programRepository";
import { createCopyTitle, sanitizeProgramForm } from "../../programs/services/programService";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const ProgramManagementSection = (): JSX.Element => {
  const navigate = useNavigate();
  const { programState, programs, listItems, filters, setFilters } = usePrograms(conditionLabAppId);

  const refreshTarget = (id: string) => programs.find((program) => program.id === id);

  const handleDuplicate = async (id: string) => {
    const source = refreshTarget(id);
    if (!source) return;
    await programRepository.duplicateProgram(conditionLabAppId, source, createCopyTitle(source.title, programs));
  };

  const handleToggleFavorite = async (id: string) => {
    const source = refreshTarget(id);
    if (!source) return;
    await programRepository.updateProgram(
      conditionLabAppId,
      toProgramId(id),
      sanitizeProgramForm({
        ...programToFormValues(source),
        favorite: !source.favorite,
      }),
    );
  };

  return (
    <ProgramList
      state={programState}
      programs={listItems}
      filters={filters}
      onFiltersChange={setFilters}
      onCreate={() => navigate(routeBuilder.newProgram())}
      onEdit={(id) => navigate(routeBuilder.editProgram(id))}
      onDuplicate={handleDuplicate}
      onArchive={(id) => programRepository.archiveProgram(conditionLabAppId, toProgramId(id))}
      onRestore={(id) => programRepository.restoreProgram(conditionLabAppId, toProgramId(id))}
      onToggleFavorite={handleToggleFavorite}
    />
  );
};
