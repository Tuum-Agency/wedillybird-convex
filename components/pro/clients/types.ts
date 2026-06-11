import type { ClientStage } from '@/lib/pro/clients';

export interface ClientRow {
  _id: string;
  partnerA: string;
  partnerB?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  stage: ClientStage;
  source?: string;
  weddingDate?: number;
  venue?: string;
  budgetMinor?: number;
  budgetBookedMinor?: number;
  assigneeId?: string;
  assigneeName?: string;
  notes?: string;
  eventId?: string;
  lastContactAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemberOption {
  _id: string;
  name: string;
}
