import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties } from "react";
import type { WorkoutPrintDocument } from "../../types/print.types";
import { formatPrintDate } from "../../utils/formatPrintDate";

interface WorkoutPrintTemplateV1Props {
  document: WorkoutPrintDocument;
}

export const WorkoutPrintTemplateV1 = ({ document }: WorkoutPrintTemplateV1Props): JSX.Element => {
  const runtimeBodyParts = document.bodyParts.map((value) => value.trim().replace(/[_\s]*\([^)]*\)$/u, "")).filter(Boolean);
  const bodyPartText = runtimeBodyParts.length > 0 ? runtimeBodyParts.join(" · ") : document.program.categoryLabel;
  const setLabels = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
  return (
    <article className="a5-workout-document" aria-label="A5 가로 운동 일지" data-layout-density={document.layout.density} data-top-binding-safe-mm={document.layout.topBindingSafeAreaMm} style={{ "--a5-binding-safe-area": `${document.layout.topBindingSafeAreaMm}mm` } as CSSProperties}>
      <header className="print-header">
        <div className="print-brand-block">
          <div className="print-logo">BASECAMP</div>
          <div className="print-subtitle">운동 프로그램</div>
        </div>
        <div className="print-meta print-meta-grid">
          <div><strong>프로그램</strong><span>{document.program.title}</span></div>
          <div><strong>회원</strong><span>{document.member.name}</span></div>
          <div><strong>운동일</strong><span>{formatPrintDate(document.printDate)}</span></div>
          <div><strong>운동 부위</strong><span>{bodyPartText}</span></div>
          <div><strong>시작 시간</strong><span className="blank-line" /></div>
          <div><strong>종료 시간</strong><span className="blank-line" /></div>
        </div>
        <div className="print-session-code" aria-label={`Workout Session ${document.workoutSessionId}`}>
          <QRCodeSVG value={document.workoutSessionId} size={68} level="M" marginSize={0} />
          <span>{document.workoutSessionId}</span>
        </div>
      </header>

      <section className="exercise-print-table" aria-label="운동 기록표" role="table">
        <div className="exercise-table-header" role="row"><span role="columnheader">운동 종목</span><span role="columnheader">기록</span></div>
        <div role="rowgroup">
          {document.rows.map((row) => {
            const useFiveSetLayout = row.isBlank || row.configuredSets === 5;
            const setCount = useFiveSetLayout ? 5 : 4;
            const hasPointCell = !useFiveSetLayout && row.configuredSets !== null && row.configuredSets <= 4;
            return (
              <div className={`exercise-row ${hasPointCell ? "four-set-row" : "five-set-row"}`} key={row.order} role="row">
                <div className="exercise-name-cell" role="cell">
                  <div className="exercise-title">{row.isBlank ? "" : `${row.order}. ${row.exerciseName}`}</div>
                </div>
                {hasPointCell ? <div className="exercise-point-cell" role="cell"><span className="exercise-point-label">운동 포인트</span><span className="exercise-point-text">{row.exerciseMemo.trim() || "—"}</span></div> : null}
                {setLabels(setCount).map((setNumber) => <div className="set-cell" key={setNumber} role="cell"><span className="set-label">SET {setNumber}</span><span className="set-fields">kg / 횟수 / 수축</span></div>)}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="print-footer">BASECAMP CONDITION LAB</footer>
    </article>
  );
};
