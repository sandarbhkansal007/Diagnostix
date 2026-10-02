export interface ApiValidationIssue {
  readonly loc: readonly (string | number)[];
  readonly msg: string;
  readonly type: string;
}

export type ApiErrorDetail = string | readonly ApiValidationIssue[] | Record<string, unknown>;