import fs from "node:fs";
import { startStandIn } from "./standin.mjs";

const port = Number(process.argv[2] || 4711);
const { log } = await startStandIn(port);
console.log("stand-in up on", port);
setInterval(() => {
  try {
    fs.writeFileSync("/tmp/standin-log.json", JSON.stringify(log));
  } catch (e) {
    /* the log is best-effort */
  }
}, 2000);
