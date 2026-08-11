import ArchiveIcon from "@mui/icons-material/Archive";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import RestoreIcon from "@mui/icons-material/Restore";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Box, Card, CardActionArea, CardActions, CardContent, Chip, IconButton, Stack, Typography } from "@mui/material";
import { palette } from "../../../../theme/palette";
import type { ProgramListItem } from "../../types/programViewModel.types";

interface ProgramCardProps {
  program: ProgramListItem;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

const iconActionSx = { minHeight: 48, minWidth: 48 };

export const ProgramCard = ({
  program,
  onEdit,
  onDuplicate,
  onArchive,
  onRestore,
  onToggleFavorite,
}: ProgramCardProps): JSX.Element => (
  <Card sx={{ opacity: program.isArchived ? 0.68 : 1 }}>
    <CardActionArea
      aria-label={`${program.title} 프로그램 수정`}
      onClick={() => onEdit(program.id)}
      sx={{ minHeight: 144, "&:active": { bgcolor: palette.primaryGoldMuted } }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack alignItems="flex-start" direction="row" justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="h3">{program.title}</Typography>
              <Typography color="text.secondary" variant="body2">
                최근 사용 {program.lastUsedLabel} · 수정 {program.updatedAtLabel}
              </Typography>
            </Box>
            <EditIcon color="primary" aria-hidden="true" />
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
    </CardActionArea>
    <CardActions sx={{ gap: 0.5, justifyContent: "flex-end", px: 2, pb: 2 }}>
      <IconButton
        aria-label={program.favorite ? `${program.title} 즐겨찾기 해제` : `${program.title} 즐겨찾기 추가`}
        aria-pressed={program.favorite}
        onClick={() => onToggleFavorite(program.id)}
        sx={iconActionSx}
      >
        {program.favorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
      </IconButton>
      <IconButton aria-label={`${program.title} 복사`} onClick={() => onDuplicate(program.id)} sx={iconActionSx}>
        <ContentCopyIcon />
      </IconButton>
      {program.isArchived ? (
        <IconButton aria-label={`${program.title} 복원`} onClick={() => onRestore(program.id)} sx={iconActionSx}>
          <RestoreIcon />
        </IconButton>
      ) : (
        <IconButton aria-label={`${program.title} Archive`} onClick={() => onArchive(program.id)} sx={iconActionSx}>
          <ArchiveIcon />
        </IconButton>
      )}
    </CardActions>
  </Card>
);
