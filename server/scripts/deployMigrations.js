import { spawn } from "node:child_process";
import { emitOperationalAlert } from "../src/services/alerts.js";
import { logger } from "../src/utils/logger.js";

try {
  await run("npx", ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  logger.info("migration_deploy_succeeded");
} catch (error) {
  emitOperationalAlert("migration_failure", "Migration deploy failed", { error: error.message });
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}
