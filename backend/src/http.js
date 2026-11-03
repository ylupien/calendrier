/** Error answered to the client: key = message in locales/<lang>.json (errors.<key>), params = its values. */
export class HttpError extends Error {
  constructor(status, key, params = {}) {
    super(key);
    this.status = status;
    this.key = key;
    this.params = params;
  }
}

export const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
