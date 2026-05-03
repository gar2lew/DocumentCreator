import type { Deal } from '../../deals/types';
import { generateDocumentPack, type DocumentPackFile } from './documentPackService';
import { createDocumentPackZipBlob } from './documentPackDownloadService';
import { uploadFirebaseBlob } from '../../../shared/firebase/storage';
import {
  addDoc,
  collection,
  db,
  serverTimestamp,
  COLLECTIONS,
} from '../../../shared/firebase/collections';
import type { Project, Template } from '../../../shared/types';

export interface PersistedDocumentPackFile {
  name: string;
  url: string;
  type: string;
}

export interface PersistedDocumentPack {
  id: string;
  dealId: string;
  organisationId: string;
  files: PersistedDocumentPackFile[];
  packUrl?: string;
  createdAt: Date;
  createdBy: string;
}

interface PersistDocumentPackInput {
  dealId: string;
  organisationId: string;
  createdBy: string;
  packFiles: DocumentPackFile[];
}

function fileType(file: DocumentPackFile): string {
  return file.blob.type || file.filename.split('.').pop() || 'application/octet-stream';
}

async function uploadPackFile(
  organisationId: string,
  dealId: string,
  timestamp: number,
  file: DocumentPackFile
): Promise<PersistedDocumentPackFile> {
  const type = fileType(file);
  const path = `/generated/${organisationId}/${dealId}/${timestamp}/${file.filename}`;
  const { downloadUrl } = await uploadFirebaseBlob(path, file.blob, type);

  return {
    name: file.filename,
    url: downloadUrl,
    type,
  };
}

export async function persistDocumentPack({
  dealId,
  organisationId,
  createdBy,
  packFiles,
}: PersistDocumentPackInput): Promise<PersistedDocumentPack> {
  const timestamp = Date.now();
  const files = await Promise.all(
    packFiles.map((file) => uploadPackFile(organisationId, dealId, timestamp, file))
  );
  const zipBlob = await createDocumentPackZipBlob(packFiles);
  const { downloadUrl: packUrl } = await uploadFirebaseBlob(
    `/generated/${organisationId}/${dealId}/${timestamp}/pack.zip`,
    zipBlob,
    'application/zip'
  );

  const ref = await addDoc(collection(db, COLLECTIONS.DOCUMENTS_GENERATED), {
    dealId,
    organisationId,
    files,
    packUrl,
    createdAt: serverTimestamp(),
    createdBy,
  });

  return {
    id: ref.id,
    dealId,
    organisationId,
    files,
    packUrl,
    createdAt: new Date(),
    createdBy,
  };
}

export async function generateAndPersistDocumentPack(
  deal: Deal,
  templates: Template[],
  createdBy: string,
  project?: Project | null
): Promise<PersistedDocumentPack> {
  const packFiles = await generateDocumentPack(deal, templates, project);

  return persistDocumentPack({
    dealId: deal.id,
    organisationId: deal.organisationId,
    createdBy,
    packFiles,
  });
}
