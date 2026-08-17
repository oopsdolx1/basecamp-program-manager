import { QRCodeSVG } from "qrcode.react";
import { PRINT_SET_COLUMN_COUNT } from "../../constants/print.constants";
import { formatPrintDate } from "../../utils/formatPrintDate";
import { bodyPartLabels } from "../../utils/mapCategoryToBodyParts";
import type { WorkoutPrintDocument } from "../../types/print.types";

interface WorkoutPrintTemplateV1Props {
  document: WorkoutPrintDocument;
}

export const WorkoutPrintTemplateV1 = ({ document }: WorkoutPrintTemplateV1Props): JSX.Element => {
  const runtimeBodyParts = document.bodyParts.map((value) => value.trim()).filter(Boolean);
  const knownBodyParts = bodyPartLabels.filter((item) => runtimeBodyParts.some((value) =>
    value === item.label || value.includes(item.label),
  ));
  const unknownBodyParts = runtimeBodyParts.filter((value) =>
    !bodyPartLabels.some((item) => value === item.label || value.includes(item.label)),
  );
  const setColumns = Array.from({ length: PRINT_SET_COLUMN_COUNT }, (_, index) => index + 1);

  return (
    <article className="a5-workout-document" aria-label="A5 운동 기록지">
      <header className="print-header">
        <div className="print-brand-block">
          <div className="print-logo">BaseCamp</div>
          <div className="print-subtitle">Workout Log · {document.program.title}</div>
        </div>
        <div className="print-meta">
          <div>회원: {document.member.name}</div>
          <div>날짜: {formatPrintDate(document.printDate)}</div>
          <div>카테고리: {document.program.categoryLabel}</div>
        </div>
        <div className="print-session-code" aria-label={`Workout Session ${document.workoutSessionId}`}>
          <QRCodeSVG value={document.workoutSessionId} size={68} level="M" marginSize={0} />
          <span>{document.workoutSessionId}</span>
        </div>
      </header>

      <section className="print-section">
        <div className="print-info-grid">
          <div>오늘의 컨디션 <span className="blank-line" /></div>
          <div>운동 전 혈압 <span className="blank-line" /></div>
          <div>운동 후 혈압 <span className="blank-line" /></div>
        </div>
      </section>

      <section className="print-section">
        <div className="print-section-title">운동 부위</div>
        <div className="body-part-grid">
          {bodyPartLabels.map((item) => (
            <span key={item.key}>
              <span className={`print-checkbox ${knownBodyParts.includes(item) ? "checked" : ""}`} />
              {item.label}
            </span>
          ))}
          {unknownBodyParts.map((label) => (
            <span key={label}><span className="print-checkbox checked" />{label}</span>
          ))}
        </div>
      </section>

      <section className="print-section">
        <div className="print-info-grid">
          <div>유산소 종류 <span className="blank-line" /></div>
          <div>시간 <span className="blank-line" /></div>
          <div>강도 <span className="blank-line" /></div>
        </div>
      </section>

      <table className="exercise-print-table">
        <thead>
          <tr>
            <th>운동 종목</th>
            {setColumns.map((setNumber) => (
              <th key={setNumber}>SET {setNumber}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {document.rows.map((row) => (
            <tr className="exercise-row" key={row.order}>
              <td className="exercise-name-cell">
                <div className="exercise-title">{row.isBlank ? "" : `${row.order}. ${row.exerciseName}`}</div>
                {row.exerciseMemo ? <div className="exercise-memo">{row.exerciseMemo}</div> : null}
                {row.memberWhy ? <div className="exercise-why">WHY: {row.memberWhy}</div> : null}
              </td>
              {setColumns.map((setNumber) => {
                const inactive = row.configuredSets !== null && setNumber > row.configuredSets;
                return (
                  <td className={`set-cell ${inactive ? "inactive" : ""}`} key={setNumber}>
                    <div className="handwrite-grid">
                      <div className="handwrite-line"><span>kg</span></div>
                      <div className="handwrite-line"><span>횟수</span></div>
                      <div className="handwrite-line"><span>수축</span></div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <section className="print-section print-memo-section">
        <div className="print-section-title">메모</div>
        <div className="print-memo" />
      </section>

      <footer className="print-footer">
        <span>BaseCamp Program Manager</span>
        <span>{document.templateKey} v{document.templateVersion}</span>
      </footer>
    </article>
  );
};
