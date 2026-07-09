/**
 * T050 P5: Verify that sanitize() converts P1 FAIL cases into PASS cases
 * by running them through mermaid.parse() after sanitization.
 *
 * Expected: all deterministic-correctable cases (42 of 55) should PASS
 * after sanitize. The remaining 13 should still FAIL (heuristic/unfixable).
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
const purify = DOMPurify(dom.window);
const DP = function(root) { return DOMPurify(root || dom.window); };
Object.assign(DP, purify);
DP.isSupported = true;
global.DOMPurify = DP;
dom.window.DOMPurify = DP;

const mermaid = require('mermaid');
const mmd = mermaid.default || mermaid;
mmd.initialize({ startOnLoad: false, suppressErrors: true });

const { sanitize } = require('./src/utils/diagramSanitize.ts');

// Mirror the P1 test cases that were FAIL. After sanitize(), check if
// mermaid.parse() now accepts them.
const tests = [
  // Category 1: keyword case
  ['gitgraph', 'gitgraph\n  commit id: "A"'],
  ['Graph TD', 'Graph TD\n  A --> B'],
  ['SEQUENCEDIAGRAM', 'SEQUENCEDIAGRAM\n  A->>B: msg'],
  ['sequencediagram', 'sequencediagram\n  A->>B: msg'],
  ['Flowchart LR', 'Flowchart LR\n  A --> B'],
  ['ClassDiagram', 'ClassDiagram\n  class A'],
  ['ErDiagram', 'ErDiagram\n  CUSTOMER ||--o{ ORDER : places'],
  ['Gantt', 'Gantt\n  title A'],
  ['Pie', 'Pie title Pets\n  "Dogs" : 50'],
  ['StateDiagram-v2', 'StateDiagram-v2\n  [*] --> Active'],
  ['Journey', 'Journey\n  title My day'],
  ['Mindmap', 'Mindmap\n  root((mindmap))'],
  ['Timeline', 'Timeline\n  title History'],
  ['Sankey-beta', 'Sankey-beta\n  A,B,10'],
  ['QuadrantChart', 'QuadrantChart\n  title T'],
  ['Xychart-beta', 'Xychart-beta\n  title "T"'],
  ['Block-beta', 'Block-beta\n  columns 3'],
  // Category 2: missing newline
  ['graph TBsubgraph', 'graph TBsubgraph S\n  A --> B\nend'],
  ['graph TDsubgraph', 'graph TDsubgraph S\n  A --> B\nend'],
  ['graph LRsubgraph', 'graph LRsubgraph S\n  A --> B\nend'],
  ['graph RLsubgraph', 'graph RLsubgraph S\n  A --> B\nend'],
  ['graph BTsubgraph', 'graph BTsubgraph S\n  A --> B\nend'],
  ['flowchart TBsubgraph', 'flowchart TBsubgraph S\n  A --> B\nend'],
  ['flowchart LRsubgraph', 'flowchart LRsubgraph S\n  A --> B\nend'],
  ['sequenceDiagramA', 'sequenceDiagramA->>B: msg'],
  ['gitGraphcommit', 'gitGraphcommit id: "A"'],
  ['graph TDA[B]', 'graph TDA[B] --> C'],
  // Category 3: fullwidth syntax position
  ['fullwidth parens shape', 'graph TD\n  A（text）--> B[text]'],
  ['fullwidth brackets shape', 'graph TD\n  A【text】--> B[text]'],
  ['fullwidth colon msg', 'sequenceDiagram\n  A->>B：消息'],
  ['fullwidth arrow', 'graph TD\n  A → B'],
  // Category 4: arrows
  ['graph ->>', 'graph TD\n  A ->> B'],
  ['graph -->>', 'graph TD\n  A -->> B'],
  ['graph ->', 'graph TD\n  A -> B'],
  ['graph =>', 'graph TD\n  A => B'],
  ['graph -x>', 'graph TD\n  A -x> B'],
  ['sequence ->>>', 'sequenceDiagram\n  A->>>B: msg'],
  ['sequence --->>', 'sequenceDiagram\n  A--->>B: msg'],
  // Category 5: structural
  ['@startuml removed', '@startuml\n  A --> B\n@enduml'],
  ['null byte', 'graph TD\n  A --> \u0000B'],
];

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const [name, code] of tests) {
    let sanitized;
    try {
      sanitized = sanitize(code, 'mermaid');
    } catch (e) {
      fail++;
      failures.push({ name, reason: 'sanitize error: ' + e.message, original: code, sanitized: '' });
      continue;
    }
    try {
      await mmd.parse(sanitized);
      pass++;
    } catch (e) {
      fail++;
      const msg = (e.message || String(e)).replace(/\n/g, ' ').substring(0, 100);
      failures.push({ name, reason: msg, original: code, sanitized });
    }
  }

  console.log(`\n=== P1 Regression via sanitize() ===`);
  console.log(`Total: ${tests.length}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  if (failures.length > 0) {
    console.log('\n=== Remaining FAIL ===');
    for (const f of failures) {
      console.log(`  [${f.name}] ${f.reason}`);
      console.log(`    original:  ${JSON.stringify(f.original)}`);
      if (f.sanitized) console.log(`    sanitized: ${JSON.stringify(f.sanitized)}`);
    }
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });