import { Box, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../../components/layout/PageContainer";
import { PrintHistorySection } from "../components/PrintHistorySection";

export const MasterPage = (): JSX.Element => (
  <PageContainer>
    <Stack alignItems="center" spacing={3}>
      <Stack spacing={1} sx={{ maxWidth: 980, width: "100%" }}>
        <Typography variant="h1">Print History</Typography>
        <Typography color="text.secondary">Program Manager에서 생성한 출력 기록을 조회합니다.</Typography>
      </Stack>
      <Box sx={{ maxWidth: 1000, width: "100%" }}>
        <PrintHistorySection />
      </Box>
    </Stack>
  </PageContainer>
);
