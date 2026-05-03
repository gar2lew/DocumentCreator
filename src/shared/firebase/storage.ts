import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './config';
import { describeFirebaseError } from './errors';

export async function uploadFirebaseBlob(
  path: string,
  blob: Blob,
  contentType?: string
): Promise<{ path: string; downloadUrl: string }> {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, contentType ? { contentType } : undefined);
    const downloadUrl = await getDownloadURL(storageRef);
    return { path, downloadUrl };
  } catch (error) {
    throw new Error(describeFirebaseError(error, 'Firebase Storage upload failed'), { cause: error });
  }
}
