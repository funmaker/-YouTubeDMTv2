import PromiseRouter from "express-promise-router";
import { LibraryImportRequest, LibraryImportResponse, LibraryListResponse } from "../../types/api";
import * as libraryController from "../controllers/library";

export const router = PromiseRouter();

router.post<never, LibraryImportResponse, LibraryImportRequest>("/", async (req, res) => {
  const track = await libraryController.add(req.body.url);
  
  res.json(track);
});

router.get<never, LibraryListResponse, never>("/", async (req, res) => {
  const list = libraryController.list();
  
  res.json(list);
});
