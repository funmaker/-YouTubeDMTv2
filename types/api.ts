
/////////////////////////
//       Commons       //
/////////////////////////

export interface ErrorResponse {
  _error: {
    code: number;
    message: string;
    stack?: string;
  };
}

export interface InitialData {
  _config: Config;
}

export interface Config {

}


/////////////////////////
//        Pages        //
/////////////////////////

export interface IndexPageResponse {
  library: Track[];
}


/////////////////////////
//         API         //
/////////////////////////

export interface Track {
  id: string;
  name: string;
  artist: string;
  length: number;
  url: string;
  downloading: boolean;
  source?: string;
  thumbnail?: string;
}

export type LibraryListResponse = Track[];

export interface LibraryImportRequest {
  url: string;
}

export type LibraryImportResponse = Track;

export enum ProcessingEventType {
  PROGRESS = "progress",
  FINISH = "finish",
  ERROR = "error",
}

export interface ProcessingProgressEvent {
  type: ProcessingEventType.PROGRESS;
  progress: number;
}

export interface ProcessingFinishEvent {
  type: ProcessingEventType.FINISH;
}

export interface ProcessingErrorEvent {
  type: ProcessingEventType.ERROR;
}

export type ProcessingEvent = ProcessingProgressEvent | ProcessingFinishEvent | ProcessingErrorEvent;
