export class CsvError extends Error {
  constructor(code, recordIndex = 0, details = {}) {
    super(code);
    this.name = 'CsvError';
    this.code = code;
    this.recordIndex = recordIndex;
    this.details = details;
  }
}

export class OrderError extends Error {
  constructor(code, { issues = [], issueCount = issues.length } = {}) {
    super(code);
    this.name = 'OrderError';
    this.code = code;
    this.issues = issues;
    this.issueCount = issueCount;
  }
}

export class OutputLimitError extends Error {
  constructor() {
    super('OUTPUT_TOO_LARGE');
    this.name = 'OutputLimitError';
    this.code = 'OUTPUT_TOO_LARGE';
  }
}
