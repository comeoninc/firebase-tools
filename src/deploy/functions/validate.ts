import * as FirebaseError from "../../error";
import * as _ from "lodash";
import * as path from "path";
import * as clc from "cli-color";
import * as logger from "../../logger";
import * as projectPath from "../../projectPath";
import * as fsutils from "../../fsutils";

// have to require this because no @types/cjson available
// tslint:disable-next-line
const cjson = require("cjson");

/**
 * Check that functions directory exists.
 * @param cwd Working directory.
 * @param sourceDirName Relative path to source directory.
 * @throws { FirebaseError } Functions directory must exist.
 */
export function functionsDirectoryExists(cwd: string, sourceDirName: string): void {
  if (!fsutils.dirExistsSync(projectPath.resolveProjectPath(cwd, sourceDirName))) {
    const msg =
      `could not deploy functions because the ${clc.bold('"' + sourceDirName + '"')} ` +
      `directory was not found. Please create it or specify a different source directory in firebase.json`;
    throw new FirebaseError(msg);
  }
}

/**
 * Validate function names only contain lower case letters, numbers, and dashes.
 * @param functionNames List of function names.
 * @throws { FirebaseError } Function names must be valid.
 */
export function functionNamesAreValid(functionNames: string[]): void {
  const validFunctionNameRegex = /^[a-z][a-zA-Z0-9_-]{1,62}$/i;
  const invalidNames = _.reject(
    _.keys(functionNames),
    (name: string): boolean => {
      return _.startsWith(name, ".") || validFunctionNameRegex.test(name);
    }
  );
  if (!_.isEmpty(invalidNames)) {
    const msg = `${invalidNames.join(
      ", "
    )} function name(s) must be a valid subdomain (lowercase letters, numbers and dashes)`;
    throw new FirebaseError(msg);
  }
}

/**
 * Validate contents of package.json to ensure main file is present.
 * @param sourceDirName Name of source directory.
 * @param sourceDir Relative path of source directory.
 * @param projectDir Relative path of project directory.
 * @throws { FirebaseError } Package.json must be present and valid.
 */
export function packageJsonIsValid(
  sourceDirName: string,
  sourceDir: string,
  projectDir: string
): void {
  const packageJsonFile = path.join(sourceDir, "package.json");
  if (fsutils.fileExistsSync(packageJsonFile)) {
    try {
      const data = cjson.load(packageJsonFile);
      logger.debug("> [functions] package.json contents:", JSON.stringify(data, null, 2));
      const indexJsFile = path.join(sourceDir, data.main || "index.js");
      if (!fsutils.fileExistsSync(indexJsFile)) {
        const msg = `${path.relative(
          projectDir,
          indexJsFile
        )} does not exist, can't deploy Firebase Functions`;
        throw new FirebaseError(msg);
      }
    } catch (e) {
      const msg = `There was an error reading ${sourceDirName}${path.sep}package.json:\n\n ${
        e.message
      }`;
      throw new FirebaseError(msg);
    }
  } else if (!fsutils.fileExistsSync(path.join(sourceDir, "function.js"))) {
    const msg = `No npm package found in functions source directory. Please run 'npm init' inside ${sourceDirName}`;
    throw new FirebaseError(msg);
  }
}
