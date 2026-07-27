export class PrintRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrintRequestError";
  }
}
