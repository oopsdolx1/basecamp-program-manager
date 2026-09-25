declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export const getDocument: (source: { data: ArrayBuffer }) => {
    destroy: () => Promise<void>;
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        cleanup: () => void;
        getViewport: (options: { scale: number }) => { width: number; height: number };
        render: (context: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number }; transform: [number, number, number, number, number, number] }) => { promise: Promise<void>; cancel: () => void };
      }>;
    }>;
  };
}

declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const workerUrl: string;
  export default workerUrl;
}
