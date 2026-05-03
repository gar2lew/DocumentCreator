export interface User {
  uid: string;
  email: string;
  displayName: string;
  organisationId: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: Date;
}

export interface Organisation {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  organisationId: string;
  name: string;
  acn: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    bsb: string;
    accountNumber: string;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TemplateType = 'text' | 'docx' | 'pdf';
export type TemplateKind = 'deed' | 'loan_agreement';

export interface PdfFieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'date' | 'number' | 'signature';
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  fontSize: number;
  fontFamily: string;
  alignment: 'left' | 'center' | 'right';
  placeholder: string;
}

export interface Template {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  type: TemplateType;
  templateKind?: TemplateKind | null;
  content: string;
  fileUrl?: string;
  placeholders?: string[];
  pdfStoragePath?: string;
  fields: PdfFieldDefinition[];
  locked: boolean;
  currentVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVersion {
  id: string;
  organisationId: string;
  templateId: string;
  version: number;
  content: string;
  fileUrl?: string;
  placeholders?: string[];
  fields: PdfFieldDefinition[];
  savedBy: string;
  savedAt: Date;
  comment?: string;
}

export interface DocumentGenerated {
  id: string;
  organisationId: string;
  templateId: string;
  templateName: string;
  projectId: string;
  projectName: string;
  format: 'pdf' | 'docx';
  storagePath: string;
  downloadUrl: string;
  generatedBy: string;
  generatedAt: Date;
  placeholderData: Record<string, string>;
  templateContent?: string;
}

export interface PlaceholderData {
  [key: string]: string;
}
