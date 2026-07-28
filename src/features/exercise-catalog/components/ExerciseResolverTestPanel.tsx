import { Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { resolveExercise } from "../../exercise-resolver";
import type { ExerciseCatalogItem } from "../domain/exerciseCatalog.types";

interface ExerciseResolverTestPanelProps {
  items: ExerciseCatalogItem[];
}

export const ExerciseResolverTestPanel = ({ items }: ExerciseResolverTestPanelProps): JSX.Element => {
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const result = useMemo(
    () => (submittedText ? resolveExercise({ text: submittedText, catalog: items }) : null),
    [items, submittedText],
  );

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="h2">Resolver Test</Typography>
            <Typography color="text.secondary" variant="body2">
              기존 Resolver 알고리즘을 호출해 Catalog 매칭 결과를 확인합니다.
            </Typography>
          </Stack>
          <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
            <TextField
              fullWidth
              label="테스트 운동명"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setSubmittedText(text);
                }
              }}
            />
            <Button variant="contained" onClick={() => setSubmittedText(text)}>
              Resolver 실행
            </Button>
          </Stack>
          {result ? (
            <Stack spacing={1.25} sx={{ border: 1, borderColor: "divider", borderRadius: 3, p: 2 }}>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Chip color={result.status === "resolved" ? "success" : result.status === "ambiguous" ? "warning" : "default"} label={result.status.toUpperCase()} />
                <Chip label={`confidence ${result.confidence}`} variant="outlined" />
                <Chip label={result.reason} variant="outlined" />
              </Stack>
              {result.exercise ? (
                <Typography fontWeight={950}>{result.exercise.name}</Typography>
              ) : null}
              {result.matchedAlias ? (
                <Typography color="text.secondary" variant="body2">
                  matched alias: {result.matchedAlias}
                </Typography>
              ) : null}
              {result.candidateExercises.length ? (
                <Stack spacing={0.5}>
                  <Typography color="text.secondary" fontWeight={900} variant="body2">
                    후보
                  </Typography>
                  {result.candidateExercises.map((candidate) => (
                    <Typography key={candidate.id} variant="body2">
                      {candidate.name}
                    </Typography>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};
