import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { routeBuilder } from "../../../app/routeBuilder";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { palette } from "../../../theme/palette";
import { toAppId, toProfileId, toProgramId } from "../../../types/brandedIds";
import { useCreatePrintRequest } from "../../print-history";
import { WorkoutPrintTemplateV1 } from "../components/WorkoutPrintTemplateV1/WorkoutPrintTemplateV1";
import { browserPrintGateway } from "../gateways/browserPrintGateway";
import { usePrintPreview } from "../hooks/usePrintPreview";
import "../styles/print.css";

const conditionLabAppId = toAppId(import.meta.env.VITE_CONDITION_LAB_APP_ID ?? "");

export const PrintPreviewPage = (): JSX.Element => {
  const { programId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const memberId = searchParams.get("memberId");
  const state = usePrintPreview({
    appId: conditionLabAppId,
    memberId: memberId ? toProfileId(memberId) : null,
    programId: programId ? toProgramId(programId) : null,
  });
  const printRequest = useCreatePrintRequest(conditionLabAppId);

  const goPrint = () => navigate(routeBuilder.print());

  const requestPrint = async () => {
    if (state.status !== "ready" || printRequest.saving) return;
    const record = await printRequest.create(state.document);
    if (!record) return;
    browserPrintGateway.print();
  };

  if (state.status === "loading") {
    return <PageContainer><LoadingState /></PageContainer>;
  }

  if (state.status === "error") {
    return (
      <PageContainer>
        <Stack spacing={2}>
          <Alert severity="error">{state.message}</Alert>
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={goPrint} sx={{ minHeight: 52 }}>Quick Print로 돌아가기</Button>
            <Button onClick={() => navigate(routeBuilder.master("programs"))} sx={{ minHeight: 52 }}>Program 관리</Button>
          </Stack>
        </Stack>
      </PageContainer>
    );
  }

  return (
    <Box>
      <PageContainer>
        <Stack className="no-print" spacing={2} sx={{ mb: 2 }}>
          {printRequest.error ? <Alert severity="error">{printRequest.error}</Alert> : null}
          <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h1">출력 미리보기</Typography>
              <Typography color="text.secondary">A5 한 페이지 운동 기록지를 인쇄 전에 확인합니다.</Typography>
            </Box>
            <Stack alignItems={{ md: "flex-end", xs: "flex-start" }} spacing={0.5}>
              <Typography fontWeight={900}>{state.document.member.name}</Typography>
              <Typography color="text.secondary">{state.document.program.title} · 운동 {state.document.program.exercises.length}개</Typography>
            </Stack>
          </Stack>
        </Stack>
      </PageContainer>

      <div className="print-preview-shell">
        <div className="print-only-root">
          <WorkoutPrintTemplateV1 document={state.document} />
        </div>
      </div>

      <Box
        className="no-print"
        sx={{
          backdropFilter: "blur(12px)",
          bgcolor: palette.surfaceRaised,
          borderTop: `1px solid ${palette.borderDefault}`,
          bottom: 0,
          pb: "max(16px, env(safe-area-inset-bottom, 0px))",
          position: "sticky",
          px: { sm: 3, xs: 2 },
          pt: 2,
          zIndex: 10,
        }}
      >
        <Stack direction={{ sm: "row", xs: "column-reverse" }} justifyContent="flex-end" spacing={1} sx={{ maxWidth: 1180, mx: "auto" }}>
          <Button disabled={printRequest.saving} startIcon={<ArrowBackIcon />} variant="outlined" onClick={goPrint} sx={{ minHeight: 52 }}>
            회원 또는 프로그램 변경
          </Button>
          <Button
            aria-label="브라우저 인쇄 창 열기"
            disabled={printRequest.saving}
            startIcon={<PrintIcon />}
            variant="contained"
            onClick={() => void requestPrint()}
            sx={{ minHeight: 56, minWidth: { sm: 200, xs: "100%" } }}
          >
            {printRequest.saving ? "인쇄 준비 중..." : "출력하기"}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
