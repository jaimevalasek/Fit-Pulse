// Calls of the file routes (IF-002): the server opens a file it saved. Only the id travels, never a path.
import { httpClient } from "./httpClient";

// Extra data of the `open_failed` error (`ApiError.details`): the folder where the file is
interface OpenFailureDetails {
  directory: string;
}

// 404 file_not_found when the file is no longer in the Downloads folder;
// 500 open_failed when the computer could not open it (`details.directory` says where it is)
function openSavedFile(fileId: string): Promise<void> {
  return httpClient.post<void>(`/api/files/${encodeURIComponent(fileId)}/open`);
}

// Same errors as openSavedFile
function revealSavedFile(fileId: string): Promise<void> {
  return httpClient.post<void>(`/api/files/${encodeURIComponent(fileId)}/reveal`);
}

export { openSavedFile, revealSavedFile };
export type { OpenFailureDetails };
