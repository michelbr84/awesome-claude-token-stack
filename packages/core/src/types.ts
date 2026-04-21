export type ObservationKind =
  | "decision"
  | "bugfix"
  | "convention"
  | "guardrail"
  | "note"
  | "warning"
  | "pattern"
  | "reference"
  | "todo";

export interface SessionRow {
  id: string;
  agent: string;
  started_at: number;
  ended_at: number | null;
  cwd: string;
  meta_json: string | null;
}

export interface ObservationRow {
  id: string;
  kind: ObservationKind;
  title: string;
  body: string;
  tags_json: string;
  source: string | null;
  created_at: number;
  updated_at: number;
  accessed_at: number | null;
  access_count: number;
  validity: number;
  ttl_seconds: number | null;
  superseded_by: string | null;
  content_hash: string;
}

export interface ToolResultRow {
  id: string;
  session_id: string | null;
  tool_name: string;
  created_at: number;
  input_json: string;
  output: string;
  output_tokens: number;
  truncated: 0 | 1;
  content_hash: string;
}

export interface CheckpointRow {
  id: string;
  session_id: string;
  created_at: number;
  context_fill: number;
  label: string | null;
  payload_json: string;
}

export interface TurnMetricRow {
  id: number;
  session_id: string;
  turn_index: number;
  at: number;
  input_tokens: number;
  output_tokens: number;
  tool_tokens: number;
  context_fill: number;
  meta_json: string | null;
}

export interface QualityScoreRow {
  id: number;
  session_id: string;
  turn_index: number;
  at: number;
  score: number;
  grade: string;
  signals_json: string;
}

export interface CompressionEventRow {
  id: number;
  session_id: string | null;
  at: number;
  kind: string;
  source: string | null;
  raw_tokens: number;
  compressed_tokens: number;
  savings: number;
}
