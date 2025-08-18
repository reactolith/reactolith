#!/usr/bin/env node
import { generateWebTypes } from "./GenerateWebTypes";

generateWebTypes({
    componentsDir: process.argv[2] || "components/ui",
    tsconfig: process.argv[3] || "./tsconfig.json",
    outFile: process.argv[4] || "web-types.json",
    libraryName: process.argv[5] || "htx-components",
    libraryVersion: process.argv[6] || "1.0.0",
});
