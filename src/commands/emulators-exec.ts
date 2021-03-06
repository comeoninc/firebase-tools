import * as childProcess from "child_process";
import { StdioOptions } from "child_process";
import * as clc from "cli-color";

import * as Command from "../command";
import getProjectNumber = require("../getProjectNumber");
import requireAuth = require("../requireAuth");
import requireConfig = require("../requireConfig");
import { Emulators } from "../emulator/types";
import * as utils from "../utils";
import * as logger from "../logger";
import * as controller from "../emulator/controller";
import { EmulatorRegistry } from "../emulator/registry";
import { FirestoreEmulator } from "../emulator/firestoreEmulator";

async function runScript(script: string): Promise<void> {
  utils.logBullet(`Running script: ${clc.bold(script)}`);

  const env: NodeJS.ProcessEnv = {};

  const firestoreInstance = EmulatorRegistry.get(Emulators.FIRESTORE);
  if (firestoreInstance) {
    const info = firestoreInstance.getInfo();
    const hostString = `${info.host}:${info.port}`;
    env[FirestoreEmulator.FIRESTORE_EMULATOR_ENV] = hostString;
  }

  const proc = childProcess.spawn(script, {
    stdio: ["inherit", "pipe", "pipe"] as StdioOptions,
    shell: true,
    windowsHide: true,
    env,
  });

  logger.debug(`Running ${script} with environment ${JSON.stringify(env)}`);

  proc.stdout.on("data", (data) => {
    process.stdout.write(data.toString());
  });

  proc.stderr.on("data", (data) => {
    process.stderr.write(data.toString());
  });

  return new Promise((resolve, reject) => {
    proc.on("error", (err: any) => {
      utils.logWarning(`There was an error running the script: ${JSON.stringify(err)}`);
      reject();
    });

    // Due to the async nature of the node child_process library, sometimes
    // we can get the "exit" callback before all "data" has been read from
    // from the script's output streams. To make the logs look cleaner, we
    // add a short delay before resolving/rejecting this promise after an
    // exit.
    const exitDelayMs = 500;
    proc.once("exit", (code, signal) => {
      if (signal) {
        utils.logWarning(`Script exited with signal: ${signal}`);
        setTimeout(reject, exitDelayMs);
      }

      if (code === 0) {
        utils.logSuccess(`Script exited successfully (code 0)`);
        setTimeout(resolve, exitDelayMs);
      } else {
        utils.logWarning(`Script exited unsuccessfully (code ${code})`);
        setTimeout(resolve, exitDelayMs);
      }
    });
  });
}

module.exports = new Command("emulators:exec <script>")
  .before(async (options: any) => {
    await requireConfig(options);
    await requireAuth(options);
    await getProjectNumber(options);
  })
  .description(
    "start the local Firebase emulators, " + "run a test script, then shut down the emulators"
  )
  .option(
    "--only <list>",
    "only run specific emulators. " +
      "This is a comma separated list of emulators to start. " +
      "Valid options are: " +
      JSON.stringify(controller.VALID_EMULATOR_STRINGS)
  )
  .action(async (script: string, options: any) => {
    try {
      await controller.startAll(options);
      await runScript(script);
    } catch (e) {
      logger.debug("Error in emulators:exec", e);
      throw e;
    } finally {
      await controller.cleanShutdown();
    }
  });
