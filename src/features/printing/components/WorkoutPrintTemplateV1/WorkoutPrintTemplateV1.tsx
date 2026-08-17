import { QRCodeSVG } from "qrcode.react";
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
  const compactCue = (value: string): string => {
    const summary = value.split(/\(상세:|상세:/u)[0].replace(/\s+/gu, " ").trim();
    return summary.length > 48 ? `${summary.slice(0, 47)}…` : summary;
  };

  return (
    <article className="a5-workout-document" aria-label="A5 가로 운동 일지">
      <header className="print-header">
        <div className="print-brand-block">
          <div className="print-logo">BASECAMP</div>
          <div className="print-subtitle">운동 일지 · {document.program.title}</div>
        </div>
        <div className="print-meta">
          <div>회원: {document.member.name}</div>
          <div>날짜: {formatPrintDate(document.printDate)}</div>
          <div>운동부위: {document.program.categoryLabel}</div>
        </div>
        <div className="print-session-code" aria-label={`Workout Session ${document.workoutSessionId}`}>
          <QRCodeSVG value={document.workoutSessionId} size={68} level="M" marginSize={0} />
          <span>{document.workoutSessionId}</span>
        </div>
      </header>

      <section className="print-section">
        <div className="print-info-grid"><div>오늘의 컨디션 <span className="blank-line" /></div><div>운동 시작 시간 <span className="blank-line" /></div><div>운동 종료 시간 <span className="blank-line" /></div></div>
      </section>

      <section className="print-section">
        <div className="print-compact-info"><div><strong>운동 부위</strong><span>{bodyPartText}</span></div><div><strong>유산소</strong><span className="cardio-write-line" /><small>종류 · 시간 · 속도 · 경사</small></div></div>
      </section>

      <table className="exercise-print-table">
        <thead><tr><th>운동 종목</th>{setColumns.map((setNumber) => <th key={setNumber}>SET {setNumber}</th>)}</tr></thead>
        <tbody>
          {document.rows.map((row) => (
            <tr className="exercise-row" key={row.order}>
              <td className="exercise-name-cell">
                <div className="exercise-title">{row.isBlank ? "" : `${row.order}. ${row.exerciseName}`}</div>
                {!row.isBlank && (row.memberWhy || row.exerciseMemo) ? <div className="exercise-cue">{compactCue(row.memberWhy || row.exerciseMemo)}</div> : null}
              </td>
              {setColumns.map((setNumber) => {
                const inactive = row.configuredSets !== null && setNumber > row.configuredSets;
                return <td className={`set-cell ${inactive ? "inactive" : ""}`} key={setNumber}><div className="handwrite-grid"><span>KG</span><span>횟수</span><span>수축</span></div></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section className="print-section print-memo-section"><div className="print-section-title">메모</div><div className="print-memo" /></section>
      <footer className="print-footer">BASECAMP CONDITION LAB</footer>
    </article>
  );
};
