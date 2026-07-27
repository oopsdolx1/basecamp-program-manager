export interface BrowserPrintGateway {
  print: () => void;
}

export const browserPrintGateway: BrowserPrintGateway = {
  print: () => window.print(),
};
