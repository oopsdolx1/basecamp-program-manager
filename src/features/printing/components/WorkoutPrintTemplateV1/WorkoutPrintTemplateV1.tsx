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
  const hasPointColumn = document.layout.setLayout === "four-set-with-note";
  const setLabels = Array.from({ length: document.layout.setLayout === "five-set" ? 5 : 4 }, (_, index) => index + 1);
  return (
    <article className="a5-workout-document" aria-label="A5 가로 운동 일지" data-layout-density={document.layout.density} data-top-binding-safe-mm={document.layout.topBindingSafeAreaMm} style={{ "--a5-binding-safe-area": `${document.layout.topBindingSafeAreaMm}mm`, "--a5-exercise-row-count": document.rows.length } as CSSProperties}>
      <header className="print-header">
        <div className="print-brand-block">
          <div className="print-logo">BASECAMP</div>
          <div className="print-member-name"><strong>회원 :</strong><span>{document.member.name}</span></div>
          <div className="print-program-name"><strong>프로그램 :</strong><span>{document.program.title}</span></div>
        </div>
        <div className="print-meta-grid" aria-label="운동 정보">
          <div className="print-meta-field"><strong>운동일 :</strong><span>{formatPrintDate(document.printDate)}.</span></div>
          <div className="print-meta-field"><strong>운동 부위 :</strong><span>{bodyPartText}</span></div>
          <div className="print-meta-field"><strong>시작 시간 :</strong><span /></div>
          <div className="print-meta-field"><strong>종료 시간 :</strong><span /></div>
          <div className="print-meta-field print-meta-cardio"><strong>유산소 :</strong><span /></div>
        </div>
        <div className="print-session-code" aria-label={`Workout Session ${document.workoutSessionId}`}>
          <QRCodeSVG value={document.workoutSessionId} size={68} level="M" marginSize={0} />
          <span>{document.workoutSessionId}</span>
        </div>
      </header>

      <section className="exercise-print-table" aria-label="운동 기록표" role="table">
        <div className={`exercise-table-header ${hasPointColumn ? "four-set-header" : "five-set-header"}`} role="row">
          <span className="exercise-table-main-header" role="columnheader">운동종목</span>
          {hasPointColumn ? <span className="exercise-table-point-header" role="columnheader">운동 포인트</span> : null}
          <div className="record-group-header" role="columnheader"><strong>기록</strong><div className="set-header-grid">{setLabels.map((setNumber) => <div className="set-header-cell" key={setNumber}><strong>SET {setNumber}</strong><span><i>Kg</i><i>횟수</i><i>수축</i></span></div>)}</div></div>
        </div>
        <div role="rowgroup">
          {document.rows.map((row) => {
            return (
              <div className={`exercise-row ${hasPointColumn ? "four-set-row" : "five-set-row"}`} key={row.order} role="row">
                <div className="exercise-name-cell" role="cell">
                  <div className="exercise-title" title={row.isBlank ? undefined : row.exerciseName}>{row.isBlank ? "" : `${row.order}. ${row.exerciseName}`}</div>
                </div>
                {hasPointColumn ? <div className="exercise-point-cell" role="cell"><span className="exercise-point-text">{row.isBlank ? "" : row.exerciseMemo.trim() || "—"}</span></div> : null}
                {setLabels.map((setNumber) => <div className="set-cell" key={setNumber} role="cell"><span className="set-writing-fields"><span /><span /><span /></span></div>)}
              </div>
            );
          })}
        </div>
      </section>

      <footer className="print-footer">BASECAMP CONDITION LAB</footer>
    </article>
  );
};
