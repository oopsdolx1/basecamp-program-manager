import { Box, Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../../components/layout/PageContainer";
import { MasterTabs, type MasterTab } from "../components/MasterTabs";
import { PrintHistorySection } from "../components/PrintHistorySection";
import { ProgramManagementSection } from "../components/ProgramManagementSection";

const isMasterTab = (value: string | null): value is MasterTab => value === "programs" || value === "history";

export const MasterPage = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: MasterTab = isMasterTab(tabParam) ? tabParam : "programs";

  const changeTab = (tab: MasterTab) => {
    const next = new URLSearchParams();
    next.set("tab", tab);
    setSearchParams(next);
  };

  return (
    <PageContainer>
      <Stack alignItems="center" spacing={3}>
        <Stack spacing={1} sx={{ maxWidth: 980, width: "100%" }}>
          <Typography variant="h1">Master</Typography>
          <Typography color="text.secondary">프로그램과 Print Request 기록을 관리합니다.</Typography>
        </Stack>
        <Box sx={{ maxWidth: 1120, width: "100%" }}>
          <MasterTabs value={activeTab} onChange={changeTab} />
        </Box>
        <Box sx={{ maxWidth: activeTab === "programs" ? 1120 : 1000, width: "100%" }}>
          {activeTab === "programs" ? <ProgramManagementSection /> : <PrintHistorySection />}
        </Box>
      </Stack>
    </PageContainer>
  );
};
