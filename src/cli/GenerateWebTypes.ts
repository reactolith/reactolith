import { Project, Node } from "ts-morph";
import fs from "fs";
import path from "path";

export interface GenerateWebTypesOptions {
    componentsDir?: string;
    outFile?: string;
    tsconfig?: string;
    libraryName?: string;
    libraryVersion?: string;
}

export function generateWebTypes(options: GenerateWebTypesOptions) {
    const project = new Project({
        tsConfigFilePath: options.tsconfig || "./tsconfig.json",
    });

    const componentsDir = path.resolve(options.componentsDir || 'components/ui');
    const files = fs
        .readdirSync(componentsDir)
        .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const elements: any[] = [];

    files.forEach((file) => {
        const sourceFile = project.getSourceFile(path.join(componentsDir, file));
        if (!sourceFile) return;

        const exported = sourceFile.getExportedDeclarations();

        for (const [name, decls] of exported) {
            if (!name.endsWith("Props")) continue;

            const decl = decls[0];
            if (!decl) continue;

            const props = extractAttributes(decl);
            const tagName = name.substring(0, name.length - 5)
                .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                .toLowerCase();

            elements.push({
                name: tagName,
                attributes: props,
            });
        }
    });

    elements.sort((a, b) => a.name.localeCompare(b.name));

    const webTypes = {
        "$schema": "https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json",
        name: options.libraryName || "htx-components",
        version: options.libraryVersion || "1.0.0",
        contributions: { html: { elements } },
    };
    const outFile = options.outFile || 'web-types.json';
    fs.writeFileSync(outFile, JSON.stringify(webTypes, null, 2));
    console.log(`✅ ${outFile} generated (${elements.length} components.)`);
}

function extractAttributes(decl: Node) {
    const type = (decl as any).getType?.();
    if (!type) return [];

    const props: any = {};
    type.getProperties().forEach((prop: any) => {
        const t = prop.getTypeAtLocation(decl);
        props[prop.getName()] = { required: !prop.isOptional(), type: t.getText() };
    });

    return Object.entries(props).map(([name, info]: any) => {
        const attr: any = { name, required: info.required };
        if (info.type.includes("|")) {
            attr.values = info.type
                .split("|")
                .map((v: string) => v.trim().replace(/['"]/g, ""))
                .map((v: string) => ({ name: v }));
        } else {
            attr.value = info.type;
        }
        return attr;
    });
}
