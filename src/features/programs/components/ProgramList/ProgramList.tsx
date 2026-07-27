import AddIcon from "@mui/icons-material/Add";
import { Button, Grid, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../../components/common/EmptyState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import type { Loadable } from "../../../../types/common.types";
import { ProgramCard } from "../ProgramCard/ProgramCard";
import type { Program } from "../../types/program.types";
import type { ProgramListItem } from "../../types/programViewModel.types";
import { ProgramFilters } from "../ProgramFilters/ProgramFilters";
import type { ProgramFilters as ProgramFiltersValue } from "../../types/programViewModel.types";

interface ProgramListProps {
  state: Loadable<Program[]>;
  programs: ProgramListItem[];
  filters: ProgramFiltersValue;
  onFiltersChange: (filters: ProgramFiltersValue) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ProgramList = ({
  state,
  programs,
  filters,
  onFiltersChange,
  onCreate,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onToggleFavorite,
}: ProgramListProps): JSX.Element => (
  <Stack spacing={3}>
    <Stack alignItems="center" direction="row" justifyContent="space-between">
      <Stack spacing={0.5}>
        <Typography variant="h1">프로그램 관리</Typography>
        <Typography color="text.secondary">재사용 가능한 운동 프로그램을 만들고 관리합니다.</Typography>
      </Stack>
      <Button startIcon={<AddIcon />} variant="contained" onClick={onCreate}>
        새 프로그램
      </Button>
    </Stack>
    <ProgramFilters filters={filters} onChange={onFiltersChange} />
    {state.status === "loading" ? <LoadingState /> : null}
    {state.status === "error" ? <ErrorState message={state.message} /> : null}
    {state.status === "ready" && programs.length === 0 ? (
      <EmptyState title="프로그램이 없습니다." description="새 프로그램을 만들어 운동 구성을 저장해 보세요." />
    ) : null}
    <Grid container spacing={2}>
      {programs.map((program) => (
        <Grid item key={program.id} md={6} xs={12}>
          <ProgramCard
            program={program}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onRestore={onRestore}
            onToggleFavorite={onToggleFavorite}
          />
        </Grid>
      ))}
    </Grid>
  </Stack>
);
