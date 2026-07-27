import ArchiveIcon from "@mui/icons-material/Archive";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import RestoreIcon from "@mui/icons-material/Restore";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Box, Card, CardActions, CardContent, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { ProgramListItem } from "../../types/programViewModel.types";

interface ProgramCardProps {
  program: ProgramListItem;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ProgramCard = ({
  program,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onToggleFavorite,
}: ProgramCardProps): JSX.Element => (
  <Card sx={{ opacity: program.isArchived ? 0.68 : 1 }}>
    <CardContent>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h3">{program.title}</Typography>
            <Typography color="text.secondary" variant="body2">
              최근 사용 {program.lastUsedLabel} · 수정 {program.updatedAtLabel}
            </Typography>
          </Box>
          <Tooltip title="즐겨찾기">
            <IconButton onClick={() => onToggleFavorite(program.id)}>
              {program.favorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip label={program.categoryLabel} size="small" />
          <Chip label={program.difficultyLabel} size="small" variant="outlined" />
          <Chip label={`${program.exerciseCount}개 운동`} size="small" variant="outlined" />
          <Chip label={`${program.usageCount}회 사용`} size="small" variant="outlined" />
          {program.isArchived ? <Chip color="warning" label="Archived" size="small" /> : null}
        </Stack>
        <Typography color="text.secondary" variant="body2">
          {program.exerciseNames.join(", ") || "운동 없음"}
        </Typography>
      </Stack>
    </CardContent>
    <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
      <Tooltip title="수정">
        <IconButton onClick={() => onEdit(program.id)}>
          <EditIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="복사">
        <IconButton onClick={() => onDuplicate(program.id)}>
          <ContentCopyIcon />
        </IconButton>
      </Tooltip>
      {program.isArchived ? (
        <Tooltip title="복원">
          <IconButton onClick={() => onRestore(program.id)}>
            <RestoreIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Archive">
          <IconButton onClick={() => onArchive(program.id)}>
            <ArchiveIcon />
          </IconButton>
        </Tooltip>
      )}
    </CardActions>
  </Card>
);
