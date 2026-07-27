import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert } from "@mui/material";
import { PageContainer } from "../../../components/layout/PageContainer";
import { routeBuilder } from "../../../app/routeBuilder";
import { toAppId, toProgramId } from "../../../types/brandedIds";
import { programRepository } from "../repositories/programRepository";
import { createCopyTitle } from "../services/programService";
import { programToFormValues } from "../mappers/programMapper";
import { ProgramEditor } from "../components/ProgramEditor/ProgramEditor";
import type { Program, ProgramFormValues } from "../types/program.types";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const ProgramEditorPage = (): JSX.Element => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    setLoading(true);
    programRepository
      .getProgram(conditionLabAppId, toProgramId(id))
      .then((result) => {
        setProgram(result);
        setError(result ? null : "프로그램을 찾지 못했습니다.");
      })
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : "Unknown error";
        setError(`프로그램을 읽지 못했습니다. (${message})`);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (values: ProgramFormValues) => {
    setSaving(true);
    try {
      if (program) {
        await programRepository.updateProgram(conditionLabAppId, program.id, values);
      } else {
        await programRepository.createProgram(conditionLabAppId, values);
      }
      navigate(routeBuilder.programs());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(`저장하지 못했습니다. (${message})`);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!program) {
      return;
    }

    const programs = await programRepository.getPrograms(conditionLabAppId);
    await programRepository.duplicateProgram(
      conditionLabAppId,
      program,
      createCopyTitle(program.title, programs),
    );
    navigate(routeBuilder.programs());
  };

  const handleArchive = async () => {
    if (!program) {
      return;
    }

    await programRepository.archiveProgram(conditionLabAppId, program.id);
    navigate(routeBuilder.programs());
  };

  if (loading) {
    return <PageContainer>프로그램을 불러오는 중입니다.</PageContainer>;
  }

  return (
    <PageContainer>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <ProgramEditor
        key={program?.id ?? "new"}
        appId={conditionLabAppId}
        initialValues={program ? programToFormValues(program) : undefined}
        program={program ?? undefined}
        saving={saving}
        onSave={handleSave}
        onCancel={() => navigate(routeBuilder.programs())}
        onDuplicate={program ? handleDuplicate : undefined}
        onArchive={program && !program.isArchived ? handleArchive : undefined}
      />
    </PageContainer>
  );
};
