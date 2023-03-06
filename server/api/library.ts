import PromiseRouter from "express-promise-router";
import { LibraryListResponse } from "../../types/api";
import * as libraryController from "../controllers/library";

export const router = PromiseRouter();

router.get<never, LibraryListResponse, never>("/", (req, res) => {
  const list = libraryController.list();
  
  res.json(list);
});
