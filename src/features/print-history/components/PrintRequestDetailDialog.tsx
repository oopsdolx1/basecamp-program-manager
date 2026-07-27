import { Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { PrintRequestRecord } from "../domain/printRequest.types";
import { formatRequestedAt } from "../utils/formatRequestedAt";

interface PrintRequestDetailDialogProps {
  record: PrintRequestRecord | null;
  onClose: () => void;
}

export const PrintRequestDetailDialog = ({ record, onClose }: PrintRequestDetailDialogProps): JSX.Element => (
  <Dialog fullWidth maxWidth="sm" open={Boolean(record)} onClose={onClose}>
    <DialogTitle>인쇄 요청 상세</DialogTitle>
    {record ? (
      <DialogContent>
        <Stack spacing={1.25}>
          <Typography>요청 일시: {formatRequestedAt(record.requestedAt)}</Typography>
          <Typography>회원: {record.memberSnapshot.name}</Typography>
          <Typography>프로그램: {record.programSnapshot.title}</Typography>
          <Typography>
            {record.programSnapshot.categoryLabel} · {record.programSnapshot.difficultyLabel}
          </Typography>
          <Typography>
            템플릿: {record.template.templateKey} v{record.template.templateVersion}
          </Typography>
          <Typography>템플릿 승인 상태: {record.template.approvalStatus}</Typography>
          <Typography>요청 출처: {record.requestSource}</Typography>
          <Typography>운동 목록</Typography>
          {record.programSnapshot.exercises.map((exercise) => (
            <Typography key={exercise.id} variant="body2">
              {exercise.order}. {exercise.name} · {exercise.configuredSets ?? "-"}세트
            </Typography>
          ))}
        </Stack>
      </DialogContent>
    ) : null}
  </Dialog>
);
