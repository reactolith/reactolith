import {
  Project,
  Node,
  FunctionDeclaration,
  VariableDeclaration,
  ArrowFunction,
  FunctionExpression,
  Type,
  Symbol as TsSymbol,
  SourceFile,
} from "ts-morph";
import fs from "fs";
import path from "path";

export interface GenerateWebTypesOptions {
  componentsDir?: string;
  outFile?: string;
  tsconfig?: string;
  libraryName?: string;
  libraryVersion?: string;
  prefix?: string;
}

interface ComponentInfo {
  name: string;
  propsType: Type | null;
  propsNode: Node | null;
  sourceFile: SourceFile;
}

export function generateWebTypes(options: GenerateWebTypesOptions) {
  const project = new Project({
    tsConfigFilePath: options.tsconfig || "./tsconfig.json",
  });

  const componentsDir = path.resolve(options.componentsDir || "components/ui");
  const files = fs
    .readdirSync(componentsDir)
    .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

  const elements: any[] = [];
  const prefix = options.prefix || "";

  files.forEach((file) => {
    const filePath = path.join(componentsDir, file);
    const sourceFile = project.addSourceFileAtPath(filePath);
    if (!sourceFile) return;

    // Strategy 1: Look for exported *Props types (existing behavior)
    const propsFromTypes = extractFromExportedPropsTypes(sourceFile);

    // Strategy 2: Look for exported React components and extract their props
    const propsFromComponents = extractFromComponentFunctions(sourceFile);

    // Merge results, preferring explicit Props types
    const componentMap = new Map<string, ComponentInfo>();

    propsFromComponents.forEach((info) => {
      componentMap.set(info.name, info);
    });

    propsFromTypes.forEach((info) => {
      componentMap.set(info.name, info);
    });

    componentMap.forEach((info) => {
      if (!info.propsType) return;

      const { attributes, slots } = extractAttributesAndSlots(
        info.propsType,
        info.propsNode || info.sourceFile,
      );
      const tagName =
        prefix +
        info.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

      const element: any = {
        name: tagName,
        description: `${info.name} component`,
        attributes,
      };

      // Only add slots if there are any
      if (slots.length > 0) {
        element.slots = slots;
      }

      elements.push(element);
    });
  });

  elements.sort((a, b) => a.name.localeCompare(b.name));

  const webTypes = {
    $schema:
      "https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json",
    name: options.libraryName || "htx-components",
    version: options.libraryVersion || "1.0.0",
    "js-types-syntax": "typescript",
    "description-markup": "markdown",
    contributions: {
      html: {
        elements,
      },
    },
  };
  const outFile = options.outFile || "web-types.json";
  fs.writeFileSync(outFile, JSON.stringify(webTypes, null, 2));
}

/**
 * Strategy 1: Extract from exported types ending with "Props"
 */
function extractFromExportedPropsTypes(sourceFile: SourceFile): ComponentInfo[] {
  const results: ComponentInfo[] = [];
  const exported = sourceFile.getExportedDeclarations();

  for (const [name, decls] of exported) {
    if (!name.endsWith("Props")) continue;

    const decl = decls[0];
    if (!decl) continue;

    const type = (decl as any).getType?.();
    if (!type) continue;

    const componentName = name.substring(0, name.length - 5);
    results.push({
      name: componentName,
      propsType: type,
      propsNode: decl,
      sourceFile,
    });
  }

  return results;
}

/**
 * Strategy 2: Extract props from exported React component functions
 */
function extractFromComponentFunctions(sourceFile: SourceFile): ComponentInfo[] {
  const results: ComponentInfo[] = [];
  const exported = sourceFile.getExportedDeclarations();

  for (const [name, decls] of exported) {
    // Skip Props types (handled by Strategy 1)
    if (name.endsWith("Props")) continue;

    // Skip non-PascalCase names (not React components)
    if (!/^[A-Z]/.test(name)) continue;

    const decl = decls[0];
    if (!decl) continue;

    const propsInfo = extractPropsFromDeclaration(decl);
    if (propsInfo) {
      results.push({
        name,
        propsType: propsInfo.type,
        propsNode: propsInfo.node,
        sourceFile,
      });
    }
  }

  // Also check for default export
  const defaultExport = sourceFile.getDefaultExportSymbol();
  if (defaultExport) {
    const decls = defaultExport.getDeclarations();
    for (const decl of decls) {
      const propsInfo = extractPropsFromDeclaration(decl);
      if (propsInfo) {
        // Use filename as component name for default exports
        const fileName = path.basename(sourceFile.getFilePath(), path.extname(sourceFile.getFilePath()));
        const componentName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
        results.push({
          name: componentName,
          propsType: propsInfo.type,
          propsNode: propsInfo.node,
          sourceFile,
        });
      }
    }
  }

  return results;
}

/**
 * Extract props type from a function/variable declaration
 */
function extractPropsFromDeclaration(
  decl: Node,
): { type: Type; node: Node } | null {
  // Handle function declarations: export function Button(props: ButtonProps) {}
  if (Node.isFunctionDeclaration(decl)) {
    return extractPropsFromFunction(decl as FunctionDeclaration);
  }

  // Handle variable declarations: export const Button = (props: ButtonProps) => {}
  if (Node.isVariableDeclaration(decl)) {
    const varDecl = decl as VariableDeclaration;
    const initializer = varDecl.getInitializer();

    if (initializer && Node.isArrowFunction(initializer)) {
      return extractPropsFromArrowFunction(initializer as ArrowFunction);
    }

    if (initializer && Node.isFunctionExpression(initializer)) {
      return extractPropsFromFunctionExpression(
        initializer as FunctionExpression,
      );
    }

    // Handle React.forwardRef, React.memo, etc.
    if (initializer && Node.isCallExpression(initializer)) {
      const args = initializer.getArguments();
      for (const arg of args) {
        if (Node.isArrowFunction(arg)) {
          return extractPropsFromArrowFunction(arg as ArrowFunction);
        }
        if (Node.isFunctionExpression(arg)) {
          return extractPropsFromFunctionExpression(arg as FunctionExpression);
        }
      }
    }
  }

  // Handle export default function() {}
  if (Node.isExportAssignment(decl)) {
    const expr = (decl as any).getExpression?.();
    if (expr) {
      if (Node.isArrowFunction(expr)) {
        return extractPropsFromArrowFunction(expr as ArrowFunction);
      }
      if (Node.isFunctionExpression(expr)) {
        return extractPropsFromFunctionExpression(expr as FunctionExpression);
      }
    }
  }

  return null;
}

function extractPropsFromFunction(
  func: FunctionDeclaration,
): { type: Type; node: Node } | null {
  const params = func.getParameters();
  if (params.length === 0) return null;

  const firstParam = params[0];
  const type = firstParam.getType();

  // Check if this looks like a React component (returns JSX)
  const returnType = func.getReturnType();
  if (!isJsxReturnType(returnType)) return null;

  return { type, node: firstParam };
}

function extractPropsFromArrowFunction(
  func: ArrowFunction,
): { type: Type; node: Node } | null {
  const params = func.getParameters();
  if (params.length === 0) return null;

  const firstParam = params[0];
  const type = firstParam.getType();

  // Check if this looks like a React component (returns JSX)
  const returnType = func.getReturnType();
  if (!isJsxReturnType(returnType)) return null;

  return { type, node: firstParam };
}

function extractPropsFromFunctionExpression(
  func: FunctionExpression,
): { type: Type; node: Node } | null {
  const params = func.getParameters();
  if (params.length === 0) return null;

  const firstParam = params[0];
  const type = firstParam.getType();

  // Check if this looks like a React component (returns JSX)
  const returnType = func.getReturnType();
  if (!isJsxReturnType(returnType)) return null;

  return { type, node: firstParam };
}

/**
 * Check if a return type looks like JSX (React.ReactElement, JSX.Element, etc.)
 */
function isJsxReturnType(type: Type): boolean {
  const text = type.getText();
  return (
    text.includes("Element") ||
    text.includes("ReactNode") ||
    text.includes("ReactElement") ||
    text.includes("JSX") ||
    text === "null" ||
    text.includes("| null")
  );
}

/**
 * Check if a type represents a React slot (ReactNode, ReactElement, etc.)
 */
function isSlotType(typeText: string): boolean {
  const slotPatterns = [
    "ReactNode",
    "ReactElement",
    "JSX.Element",
    "Element",
  ];
  // Check if type is a slot type (but not a function returning ReactNode)
  return slotPatterns.some((pattern) => typeText.includes(pattern)) &&
    !typeText.includes("=>");
}

/**
 * Extract attributes and slots from a Type
 */
function extractAttributesAndSlots(
  type: Type,
  contextNode: Node,
): { attributes: any[]; slots: any[] } {
  const attributes: any[] = [];
  const slots: any[] = [];

  type.getProperties().forEach((prop: TsSymbol) => {
    const propName = prop.getName();

    // Skip internal React props
    if (["key", "ref"].includes(propName)) return;

    const propType = prop.getTypeAtLocation(contextNode);
    const typeText = cleanTypeText(propType.getText());
    const description = getPropertyDescription(prop);
    const required = !prop.isOptional();

    // Check if this prop is a slot (ReactNode type)
    if (isSlotType(typeText)) {
      // "children" becomes the "default" slot
      const slotName = propName === "children" ? "default" : propName;
      slots.push({
        name: slotName,
        description: description || `Content for the ${slotName} slot`,
      });
      return;
    }

    // Skip children if it's not a ReactNode (e.g., string children)
    if (propName === "children") return;

    // Regular attribute
    const attr: any = {
      name: toKebabCase(propName),
      description: description || undefined,
      required,
    };

    // Parse union types for enum-like values
    if (typeText.includes("|")) {
      const values = typeText
        .split("|")
        .map((v: string) => v.trim())
        .filter((v: string) => v !== "undefined" && v !== "null");

      // Check if all values are string literals (quoted strings only)
      // Exclude primitive types like boolean, string, number, etc.
      const primitiveTypes = [
        "boolean",
        "string",
        "number",
        "object",
        "any",
        "unknown",
        "never",
      ];
      const stringLiteralValues = values.filter((v: string) =>
        /^["'].*["']$/.test(v),
      );

      const hasOnlyStringLiterals =
        stringLiteralValues.length === values.length && values.length > 0;

      const hasOnlyPrimitives = values.every((v: string) =>
        primitiveTypes.includes(v),
      );

      if (hasOnlyStringLiterals) {
        attr.value = {
          kind: "plain",
          type: typeText,
        };
        // Add enum values for better autocomplete
        attr.values = stringLiteralValues
          .map((v: string) => v.replace(/['"]/g, ""))
          .map((v: string) => ({ name: v }));
      } else if (
        hasOnlyPrimitives ||
        values.some((v: string) => v.includes("=>"))
      ) {
        // Function types or primitive unions
        attr.value = {
          kind: "expression",
          type: typeText,
        };
      } else {
        attr.value = {
          kind: "plain",
          type: typeText,
        };
      }
    } else if (typeText === "boolean") {
      // Boolean attributes can be used without value
      attr.value = {
        kind: "no-value",
        type: "boolean",
      };
    } else {
      attr.value = {
        kind: "plain",
        type: typeText,
      };
    }

    attributes.push(attr);
  });

  return { attributes, slots };
}

/**
 * Clean up type text for display
 */
function cleanTypeText(text: string): string {
  // Remove import(...) paths
  return text
    .replace(/import\([^)]+\)\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Try to extract JSDoc description from a property
 */
function getPropertyDescription(prop: TsSymbol): string | undefined {
  const declarations = prop.getDeclarations();
  for (const decl of declarations) {
    const jsDocs = (decl as any).getJsDocs?.();
    if (jsDocs && jsDocs.length > 0) {
      return jsDocs[0].getDescription?.()?.trim();
    }
  }
  return undefined;
}
