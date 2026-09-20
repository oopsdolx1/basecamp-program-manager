import type { PrintRequest } from "./browserPrintGateway";

export interface HtmlPrintArtifact { type: "html"; content: string; }
export interface PrintArtifactFactory { create: (request: PrintRequest) => Promise<HtmlPrintArtifact>; }
export interface PrintArtifactFactoryOptions { getMarkup?: (request: PrintRequest) => string; getPrintCss?: () => string; }

const readRenderedMarkup = (request: PrintRequest): string => {
  const element = document.querySelector<HTMLElement>(".print-only-root .a5-workout-document");
  if (!element || !element.textContent?.includes(request.document.workoutSessionId)) throw new Error("print_dom_unavailable");
  if (element.querySelectorAll(".exercise-row").length !== request.document.rows.length) throw new Error("print_dom_mismatch");
  return element.outerHTML;
};

const readPrintCss = (): string => {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      if (css.includes(".a5-workout-document") && css.includes("@page")) return css;
    } catch { /* Cross-origin stylesheets are never required by the print artifact. */ }
  }
  throw new Error("print_css_unavailable");
};

export const createSelfContainedPrintHtml = (markup: string, printCss: string): string => {
  if (!markup.includes("a5-workout-document") || !printCss.includes(".a5-workout-document") || !printCss.includes("@page")) throw new Error("invalid_print_artifact_source");
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>${printCss}</style></head><body><div class="print-only-root">${markup}</div></body></html>`;
};

export const createRenderedPrintArtifactFactory = ({ getMarkup = readRenderedMarkup, getPrintCss = readPrintCss }: PrintArtifactFactoryOptions = {}): PrintArtifactFactory => ({
  async create(request) { return { type: "html", content: createSelfContainedPrintHtml(getMarkup(request), getPrintCss()) }; },
});