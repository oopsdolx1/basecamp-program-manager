import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PrintIcon from "@mui/icons-material/Print";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LoadingState } from "../../../components/common/LoadingState";
import { PageContainer } from "../../../components/layout/PageContainer";
import { routeBuilder } from "../../../app/routeBuilder";
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
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (state.status === "error") {
    return (
      <PageContainer>
        <Stack spacing={2}>
          <Alert severity="error">{state.message}</Alert>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={goPrint}>
              Print로 돌아가기
            </Button>
            <Button onClick={() => navigate(routeBuilder.master("programs"))}>Master</Button>
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
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h1">출력 미리보기</Typography>
              <Typography color="text.secondary">A5 한 페이지 운동 기록지입니다.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button disabled={printRequest.saving} startIcon={<ArrowBackIcon />} onClick={goPrint}>
                돌아가기
              </Button>
              <Button
                disabled={printRequest.saving}
                startIcon={<PrintIcon />}
                variant="contained"
                aria-label="브라우저 인쇄 창 열기"
                onClick={requestPrint}
              >
                {printRequest.saving ? "인쇄 준비 중..." : "인쇄"}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </PageContainer>
      <div className="print-preview-shell">
        <div className="print-only-root">
          <WorkoutPrintTemplateV1 document={state.document} />
        </div>
      </div>
    </Box>
  );
};
