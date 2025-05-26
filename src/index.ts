import express from "express";
import helmet from "helmet";
import rateLimit from "./middleware/rateLimit";
import auth from "./middleware/auth";
import filingsRouter from "./routes/filings";
import factsRouter from "./routes/facts";

const app = express();
app.use(helmet());
app.use(express.json());
app.use(rateLimit);
app.use(auth);
app.use("/filing", filingsRouter);
app.use("/facts", factsRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`MCP server listening on ${port}`));