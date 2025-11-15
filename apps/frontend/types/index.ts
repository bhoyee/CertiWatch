export interface RecordDto {
  id: string;
  staffName: string;
  courseName: string;
  expiryDate?: string | null;
  confidenceBand: string;
}
