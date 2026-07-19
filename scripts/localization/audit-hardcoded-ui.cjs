const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const roots = ['app', 'components', 'features'];
const uiAttributes = new Set(['accessibilityLabel', 'accessibilityHint', 'label', 'placeholder', 'title']);
const findings = [];

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

function add(source, node, kind, text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!/[A-Za-z]/.test(normalized)) return;
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  findings.push({ file: path.relative(root, source.fileName).replaceAll('\\', '/'), line, kind, text: normalized });
}

for (const file of roots.flatMap((directory) => filesBelow(path.join(root, directory)))) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  function visit(node) {
    if (ts.isJsxText(node)) add(source, node, 'jsx-text', node.text);

    if (ts.isJsxAttribute(node) && uiAttributes.has(node.name.text) && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) add(source, node, node.name.text, node.initializer.text);
      if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const expression = node.initializer.expression;
        if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
          add(source, node, node.name.text, expression.text);
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const owner = node.expression.expression.getText(source);
      const method = node.expression.name.text;
      if ((owner === 'Alert' && method === 'alert') || method === 'announceForAccessibility') {
        for (const argument of node.arguments) {
          if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
            add(source, argument, `${owner}.${method}`, argument.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
}

const byFile = new Map();
for (const finding of findings) byFile.set(finding.file, (byFile.get(finding.file) ?? 0) + 1);
for (const finding of findings) console.log(`${finding.file}:${finding.line} [${finding.kind}] ${finding.text}`);
console.log('\nSummary');
for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`${count}\t${file}`);
console.log(`Total hardcoded UI candidates: ${findings.length}`);
