import AddIcon from "@mui/icons-material/Add";
import { Button, Grid, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../../components/common/EmptyState";
import { ErrorState } from "../../../../components/common/ErrorState";
import { LoadingState } from "../../../../components/common/LoadingState";
import type { Loadable } from "../../../../types/common.types";
import type { Program } from "../../types/program.types";
import type { ProgramFilters as ProgramFiltersValue, ProgramListItem } from "../../types/programViewModel.types";
import { ProgramCard } from "../ProgramCard/ProgramCard";
import { ProgramFilters } from "../ProgramFilters/ProgramFilters";

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
    <Stack alignItems="center" direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h1">Program Management</Typography>
        <Typography color="text.secondary">재사용 가능한 운동 프로그램을 만들고 관리합니다.</Typography>
      </Stack>
      <Button startIcon={<AddIcon />} variant="contained" onClick={onCreate}>
        새 프로그램
      </Button>
    </Stack>
    <ProgramFilters filters={filters} onChange={onFiltersChange} />
    {state.status === "loading" ? <LoadingState message="프로그램 목록을 불러오는 중입니다." /> : null}
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
