/* 把 TSX 中的 <component is={X}> 改成 h(X, props)，避免编译成字符串标签。 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.tsx')) out.push(full);
    }
    return out;
}

function valueText(initializer: ts.JsxAttributeValue | undefined, sf: ts.SourceFile): string {
    if (!initializer) return 'true';
    if (ts.isJsxExpression(initializer)) return initializer.expression?.getText(sf) ?? 'undefined';
    if (ts.isStringLiteral(initializer)) return JSON.stringify(initializer.text);
    return initializer.getText(sf);
}

let changedFiles = 0;
let changedNodes = 0;
for (const file of walk('src')) {
    let source = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const edits: Array<{ start: number; end: number; text: string }> = [];

    const visit = (node: ts.Node) => {
        if (
            (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
            node.tagName.getText(sf) === 'component'
        ) {
            let isExpr = '';
            const props: string[] = [];
            for (const attr of node.attributes.properties) {
                if (!ts.isJsxAttribute(attr)) continue;
                const name = attr.name.getText(sf);
                const value = valueText(attr.initializer, sf);
                if (name === 'is') isExpr = value;
                else props.push(`${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: ${value}`);
            }
            if (isExpr) {
                const selfClosing = ts.isJsxSelfClosingElement(node);
                const element = selfClosing ? node : (node.parent as ts.JsxElement);
                const end = selfClosing ? node.getEnd() : element.getEnd();
                const children = selfClosing
                    ? ''
                    : source.slice(node.getEnd(), (element as ts.JsxElement).closingElement.getStart());
                const slots = children.trim() ? `, { default: () => <>${children}</> }` : '';
                const container = element.parent;
                const isJsxChild =
                    container &&
                    (ts.isJsxElement(container) || ts.isJsxFragment(container) || ts.isJsxExpression(container));
                const expression = `h(${isExpr}, { ${props.join(', ')} }${slots})`;
                edits.push({
                    start: element.getStart(sf),
                    end,
                    text: isJsxChild ? `{${expression}}` : expression,
                });
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sf);

    if (!edits.length) continue;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
        changedNodes++;
    }
    const hasHImport = /import\s*\{[^}]*\bh\b[^}]*\}\s*from\s*'vue'/.test(source);
    if (!hasHImport) source = `import { h } from 'vue';\n${source}`;
    writeFileSync(file, source);
    changedFiles++;
}
console.log(`修复 ${changedNodes} 个动态组件节点，涉及 ${changedFiles} 个文件`);
