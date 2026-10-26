import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties } from "react";
import { PRINT_SET_COLUMN_COUNT } from "../../constants/print.constants";
import type { WorkoutPrintDocument } from "../../types/print.types";
import { formatPrintDate } from "../../utils/formatPrintDate";

interface WorkoutPrintTemplateV1Props {
  document: WorkoutPrintDocument;
}

export const WorkoutPrintTemplateV1 = ({ document }: WorkoutPrintTemplateV1Props): JSX.Element => {
  const runtimeBodyParts = document.bodyParts.map((value) => value.trim().replace(/[_\s]*\([^)]*\)$/u, "")).filter(Boolean);
  const bodyPartText = runtimeBodyParts.length > 0 ? runtimeBodyParts.join(" · ") : document.program.categoryLabel;
  const setColumns = Array.from({ length: PRINT_SET_COLUMN_COUNT }, (_, index) => index + 1);
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

      <table className="exercise-print-table">
        <thead><tr><th>운동 종목</th>{setColumns.map((setNumber) => <th key={setNumber}>SET {setNumber}</th>)}</tr></thead>
        <tbody>
          {document.rows.map((row) => (
            <tr className="exercise-row" key={row.order}>
              <td className="exercise-name-cell">
                <div className="exercise-title">{row.isBlank ? "" : `${row.order}. ${row.exerciseName}`}</div>
              </td>
              {setColumns.map((setNumber) => {
                const inactive = row.configuredSets !== null && setNumber > row.configuredSets;
                return <td className={`set-cell ${inactive ? "inactive" : ""}`} key={setNumber}><div className="handwrite-grid"><span>KG</span><span>횟수</span><span>수축</span></div></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="print-footer">BASECAMP CONDITION LAB</footer>
    </article>
  );
};
