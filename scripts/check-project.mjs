/**
 * Catch missing local modules/exports and stale demo routes before Next.js reaches Vercel.
 * Uses the same TypeScript parser shipped in devDependencies, not regex-only linting.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const entryRoots = ['app', 'components', 'lib'];
const files = [];
function walk(abs) {
  if (!fs.existsSync(abs)) return;
  for (const dirent of fs.readdirSync(abs, { withFileTypes: true })) {
    const resolved = path.join(abs, dirent.name);
    if (dirent.isDirectory()) walk(resolved);
    else if (/\.(ts|tsx)$/.test(dirent.name)) files.push(resolved);
  }
}
for (const dir of entryRoots) walk(path.join(root, dir));
const relative = (p) => path.relative(root, p).replaceAll(path.sep, '/');
const sourceCache = new Map();
function source(file) {
  if (!sourceCache.has(file)) {
    const input = fs.readFileSync(file, 'utf8');
    const ast = ts.createSourceFile(file, input, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    sourceCache.set(file, ast);
    for (const diag of ast.parseDiagnostics) failures.push(`${relative(file)}: syntax error: ${ts.flattenDiagnosticMessageText(diag.messageText, ' ')}`);
  }
  return sourceCache.get(file);
}
function isExported(node) {
  return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}
function hasDefault(node) {
  return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}
function getExports(file) {
  const exported = new Set();
  const ast = source(file);
  for (const statement of ast.statements) {
    if (ts.isExportAssignment(statement)) exported.add('default');
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const spec of statement.exportClause.elements) exported.add(spec.name.text);
    }
    if (!isExported(statement)) continue;
    if (hasDefault(statement)) exported.add('default');
    if (statement.name?.text) exported.add(statement.name.text);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text);
      }
    }
  }
  return exported;
}
function localTarget(imported, importer) {
  let stem;
  if (imported.startsWith('@/')) stem = path.join(root, imported.slice(2));
  else if (imported.startsWith('./') || imported.startsWith('../')) stem = path.resolve(path.dirname(importer), imported);
  else return null;
  const candidates = [stem, ...['.ts', '.tsx', '.js', '.jsx', '.json'].map(e => stem + e),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx'].map(f => path.join(stem, f))];
  return candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile()) ?? false;
}
let count=0;
for (const file of files) {
  const ast=source(file);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const imported=statement.moduleSpecifier.text;
    const target=localTarget(imported, file);
    if (target === null) continue;
    count++;
    if (!target) {
      failures.push(`${relative(file)}: ${imported} not found`);
      continue;
    }
    if (!/\.tsx?$/.test(target) || !statement.importClause) continue;
    const exported=getExports(target);
    const {name, namedBindings}=statement.importClause;
    if (name && !exported.has('default')) failures.push(`${relative(file)}: ${imported} has no default export (${name.text})`);
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const binding of namedBindings.elements) {
        const symbol=binding.propertyName?.text ?? binding.name.text;
        if (!exported.has(symbol)) failures.push(`${relative(file)}: ${imported} has no named export ${symbol}`);
      }
    }
  }
}
const removedFiles = [
  'app/demo/page.tsx', 'app/doctor/session/page.tsx', 'app/id/demo-child-001/page.tsx',
  'components/ui/DemoTag.tsx', 'data/demo/patients.ts', 'data/demo/devices.ts',
  'public/cinematic/index.html',
];
for (const obsolete of removedFiles) {
  if (fs.existsSync(path.join(root, obsolete))) failures.push(`OBSOLETE FILE: ${obsolete} (remove it from GitHub instead of merging old and new directories)`);
}
if (failures.length) {
  console.error(`\nVITAL project check failed (${failures.length} issue(s)):\n- ${failures.join('\n- ')}\n`);
  process.exitCode=1;
} else {
  console.log(`VITAL project structure OK: ${files.length} TS/TSX files and ${count} local module references checked; no obsolete routes.`);
}
