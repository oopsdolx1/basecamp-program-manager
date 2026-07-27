import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import { EmptyState } from "../../../components/common/EmptyState";
import type { PrintRequestRecord } from "../domain/printRequest.types";
import { formatRequestedAt } from "../utils/formatRequestedAt";

interface PrintRequestListProps {
  records: PrintRequestRecord[];
  onSelect: (record: PrintRequestRecord) => void;
}

export const PrintRequestList = ({ records, onSelect }: PrintRequestListProps): JSX.Element => {
  if (records.length === 0) {
    return <EmptyState title="인쇄 요청 기록이 없습니다." description="조건에 맞는 기록이 없습니다." />;
  }

  return (
    <Stack spacing={1.25}>
      {records.map((record) => (
        <Card key={record.id}>
          <CardActionArea onClick={() => onSelect(record)}>
            <CardContent>
              <Stack spacing={1}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={formatRequestedAt(record.requestedAt)} size="small" />
                  <Chip label={record.programSnapshot.categoryLabel} size="small" variant="outlined" />
                  <Chip label={record.template.approvalStatus} size="small" variant="outlined" />
                </Stack>
                <Typography fontWeight={800}>{record.programSnapshot.title}</Typography>
                <Typography color="text.secondary">{record.memberSnapshot.name}</Typography>
                <Typography color="text.secondary" variant="body2">
                  운동 {record.programSnapshot.exercises.length}개 · {record.template.templateKey} v
                  {record.template.templateVersion}
                </Typography>
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Stack>
  );
};
