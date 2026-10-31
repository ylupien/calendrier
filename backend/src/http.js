export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
