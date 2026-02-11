#!/usr/bin/env node
import { generateWebTypes } from "./GenerateWebTypes";
import fs from "fs";

/**
 * Detect the default tsconfig file.
 * Prefers tsconfig.app.json (common in Vite/modern setups) over tsconfig.json
 */
function detectDefaultTsconfig(): string {
  if (fs.existsSync("./tsconfig.app.json")) {
    return "./tsconfig.app.json";
  }
  return "./tsconfig.json";
}

function printHelp() {
  console.log(`
Usage: generate-web-types [options]

Options:
  --components, -c <dir>      Components directory (default: components/ui)
  --tsconfig, -t <file>       TypeScript config file (default: tsconfig.app.json if exists, else tsconfig.json)
  --out, -o <file>            Output file (default: web-types.json)
  --name, -n <name>           Library name (default: reactolith-components)
  --version, -v <version>     Library version (default: 1.0.0)
  --prefix, -p <prefix>       Element name prefix (default: "")
  --help, -h                  Show this help message

Examples:
  generate-web-types -c src/components -o web-types.json
  generate-web-types --components ./ui --prefix ui- --name my-ui-lib
`);
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith("-")) {
      const key = arg.replace(/^-+/, "");
      const value = args[i + 1];

      switch (key) {
        case "components":
        case "c":
          result.componentsDir = value;
          break;
        case "tsconfig":
        case "t":
          result.tsconfig = value;
          break;
        case "out":
        case "o":
          result.outFile = value;
          break;
        case "name":
        case "n":
          result.libraryName = value;
          break;
        case "version":
        case "v":
          result.libraryVersion = value;
          break;
        case "prefix":
        case "p":
          result.prefix = value;
          break;
      }
      i += 2;
    } else {
      // Positional arguments (legacy support)
      if (!result.componentsDir) {
        result.componentsDir = arg;
      } else if (!result.tsconfig) {
        result.tsconfig = arg;
      } else if (!result.outFile) {
        result.outFile = arg;
      }
      i++;
    }
  }

  return result;
}

const options = parseArgs(process.argv.slice(2));

generateWebTypes({
  componentsDir: options.componentsDir || "components/ui",
  tsconfig: options.tsconfig || detectDefaultTsconfig(),
  outFile: options.outFile || "web-types.json",
  libraryName: options.libraryName || "reactolith-components",
  libraryVersion: options.libraryVersion || "1.0.0",
  prefix: options.prefix || "",
});
