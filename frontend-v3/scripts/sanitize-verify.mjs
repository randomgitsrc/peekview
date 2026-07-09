import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
try { global.navigator = dom.window.navigator; } catch (_) {}
const purify = DOMPurify(dom.window);
const DP = function(root) { return DOMPurify(root || dom.window); };
Object.assign(DP, purify);
DP.isSupported = true;
global.DOMPurify = DP;
dom.window.DOMPurify = DP;

const mermaid = (await import('mermaid')).default;
mermaid.initialize({ startOnLoad: false, suppressErrors: true });

const mod = await import('../src/utils/diagramSanitize.ts');
const { sanitize } = mod;

const tests = [
  ['gitgraph', 'gitgraph\n  commit id: "A"'],
  ['Graph TD', 'Graph TD\n  A --> B'],
  ['SEQUENCEDIAGRAM', 'SEQUENCEDIAGRAM\n  A->>B: msg'],
  ['flowchart LRsubgraph', 'flowchart LRsubgraph S\n  A --> B\nend'],
  ['fullwidth parens', 'graph TD\n  A（text）--> B[text]'],
  ['fullwidth arrow', 'graph TD\n  A → B'],
  ['->> in graph', 'graph TD\n  A ->> B'],
  ['=> in graph', 'graph TD\n  A => B'],
  ['BOM sequence', '\uFEFFsequenceDiagram\n  A->>>B: msg'],
  ['TBsubgraph user', 'graph TBsubgraph 一期 ~50万\n  B1[数据汇聚] --> C1[数据]'],
  ['@startuml removed', '@startuml\n  A --> B\n@enduml'],
];

let pass = 0, fail = 0;
for (const [name, code] of tests) {
  let sanitized;
  try {
    sanitized = sanitize(code, 'mermaid');
  } catch (e) {
    console.log('SANITIZE-ERR', name, e.message.substring(0, 80));
    fail++;
    continue;
  }
  try {
    await mermaid.parse(sanitized);
    console.log('PASS', name, '->', JSON.stringify(sanitized.substring(0, 60)));
    pass++;
  } catch (e) {
    console.log('FAIL', name, '[' + (e.message||'').substring(0, 80) + ']');
    console.log('  sanitized:', JSON.stringify(sanitized.substring(0, 80)));
    fail++;
  }
}
console.log(`\nResult: ${pass}/${tests.length} pass, ${fail} fail`);