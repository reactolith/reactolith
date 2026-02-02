#!/usr/bin/env node
import { generateWebTypes } from "./GenerateWebTypes";

function printHelp() {
  console.log(`
Usage: generate-web-types [options]

Options:
  --components, -c <dir>      Components directory (default: components/ui)
  --tsconfig, -t <file>       TypeScript config file (default: ./tsconfig.json)
  --out, -o <file>            Output file (default: web-types.json)
  --name, -n <name>           Library name (default: htx-components)
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
  tsconfig: options.tsconfig || "./tsconfig.json",
  outFile: options.outFile || "web-types.json",
  libraryName: options.libraryName || "htx-components",
  libraryVersion: options.libraryVersion || "1.0.0",
  prefix: options.prefix || "",
});
