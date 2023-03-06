
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
