export interface RecordDto {
  id: string;
  staffName: string;
  courseName: string;
  issuer?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  confidenceBand: string;
  confidence?: number;
  documentType?: string | null;
  extractionConfidence?: number | null;
}
