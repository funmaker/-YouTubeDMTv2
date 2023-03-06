import PromiseRouter from "express-promise-router";
import { IndexPageResponse } from "../../types/api";
import * as libraryController from "../controllers/library";

export const router = PromiseRouter();

router.get<never, IndexPageResponse>('/', async (req, res) => {
  res.react({
    library: libraryController.list(),
  });
});

