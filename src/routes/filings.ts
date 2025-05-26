import { Router } from "express";
import { fetchFiling } from "../lib/secFetcher";
const router = Router();

router.get("/", async (req, res) => {
  const { ticker, cik, accession } = req.query as Record<string,string>;
  try {
    const stream = await fetchFiling({ ticker, cik, accession });
    stream.pipe(res);
  } catch (e:any) {
    res.status(404).json({ error: e.message });
  }
});

export default router;