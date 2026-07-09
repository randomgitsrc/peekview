/**
 * T050 P1: Systematic mermaid error pattern analysis
 * 
 * Runs mermaid.parse() against a comprehensive set of test cases
 * covering keyword case, missing newlines, full-width chars,
 * smart quotes, HTML mixing, arrow syntax, and common agent errors.
 * 
 * Usage: node scripts/mermaid-error-patterns.mjs
 * 
 * Output: TSV lines — PASS/FAIL | test_name | error_message
 */

import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import mermaidModule from 'mermaid';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMPurify = DOMPurify(dom.window);

const mmd = mermaidModule.default || mermaidModule;
mmd.initialize({ startOnLoad: false, suppressErrors: true });

const tests = [
  // === KEYWORD CASE ===
  ['gitgraph (wrong case)', 'gitgraph\n  commit id: "A"'],
  ['gitGraph (correct)', 'gitGraph\n  commit id: "A"'],
  ['Graph TD (wrong case)', 'Graph TD\n  A --> B'],
  ['graph td (wrong case dir)', 'graph td\n  A --> B'],
  ['SEQUENCEDIAGRAM (all caps)', 'SEQUENCEDIAGRAM\n  A->>B: msg'],
  ['sequencediagram (all lower)', 'sequencediagram\n  A->>B: msg'],
  ['sequenceDiagram (correct)', 'sequenceDiagram\n  A->>B: msg'],
  ['Flowchart LR (wrong case)', 'Flowchart LR\n  A --> B'],
  ['flowchart lr (wrong case dir)', 'flowchart lr\n  A --> B'],
  ['classDiagram (correct)', 'classDiagram\n  class A\n    A : string name'],
  ['ClassDiagram (wrong case)', 'ClassDiagram\n  class A\n    A : string name'],
  ['erDiagram (correct)', 'erDiagram\n  CUSTOMER ||--o{ ORDER : places'],
  ['ErDiagram (wrong case)', 'ErDiagram\n  CUSTOMER ||--o{ ORDER : places'],
  ['gantt (correct)', 'gantt\n  title A\n  section S\n  Task :a, 2024-01-01, 1d'],
  ['Gantt (wrong case)', 'Gantt\n  title A\n  section S\n  Task :a, 2024-01-01, 1d'],
  ['pie (correct)', 'pie title Pets\n  "Dogs" : 50\n  "Cats" : 30'],
  ['Pie (wrong case)', 'Pie title Pets\n  "Dogs" : 50\n  "Cats" : 30'],
  ['stateDiagram-v2 (correct)', 'stateDiagram-v2\n  [*] --> Active\n  Active --> [*]'],
  ['StateDiagram-v2 (wrong case)', 'StateDiagram-v2\n  [*] --> Active\n  Active --> [*]'],
  ['journey (correct)', 'journey\n  title My day\n  section Go to work\n    Make tea: 5: Me'],
  ['Journey (wrong case)', 'Journey\n  title My day\n  section Go to work\n    Make tea: 5: Me'],
  ['mindmap (correct)', 'mindmap\n  root((mindmap))\n    A\n      B\n      C'],
  ['Mindmap (wrong case)', 'Mindmap\n  root((mindmap))\n    A\n      B\n      C'],
  ['timeline (correct)', 'timeline\n  title History\n  section 2024\n    Event : something'],
  ['Timeline (wrong case)', 'Timeline\n  title History\n  section 2024\n    Event : something'],
  ['sankey (correct)', 'sankey-beta\n  A,B,10\n  B,C,5'],
  ['quadrantChart (correct)', 'quadrantChart\n  title Test\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 Q1\n  quadrant-2 Q2\n  quadrant-3 Q3\n  quadrant-4 Q4\n  A: [0.5, 0.5]'],
  ['xychart-beta (correct)', 'xychart-beta\n  title "Test"\n  x-axis [1,2,3]\n  y-axis "V" 0 --> 10\n  bar [5,8,3]'],
  ['block-beta (correct)', 'block-beta\n  columns 3\n  A:1\n  B:2'],

  // === MISSING NEWLINES ===
  ['graph TBsubgraph (no newline)', 'graph TBsubgraph S\n  A --> B\nend'],
  ['graph TDsubgraph (no newline)', 'graph TDsubgraph S\n  A --> B\nend'],
  ['graph LRsubgraph (no newline)', 'graph LRsubgraph S\n  A --> B\nend'],
  ['graph RLsubgraph (no newline)', 'graph RLsubgraph S\n  A --> B\nend'],
  ['graph BTsubgraph (no newline)', 'graph BTsubgraph S\n  A --> B\nend'],
  ['flowchart TBsubgraph (no newline)', 'flowchart TBsubgraph S\n  A --> B\nend'],
  ['flowchart LRsubgraph (no newline)', 'flowchart LRsubgraph S\n  A --> B\nend'],
  ['sequenceDiagram no newline after type', 'sequenceDiagramA->>B: msg'],
  ['gitGraph no newline after type', 'gitGraphcommit id: "A"'],
  ['graph TD no newline before node', 'graph TDA[B] --> C'],
  ['flowchart LR no newline before node', 'flowchart LRA --> B'],

  // === FULL-WIDTH CHARS ===
  ['full-width parens （）in node label', 'graph TD\n  A[数据（中文）] --> B'],
  ['full-width parens （）as shape delimiter', 'graph TD\n  A（text）--> B[text]'],
  ['full-width brackets 【】in node label', 'graph TD\n  A[数据【中文】] --> B'],
  ['full-width brackets 【】as shape delimiter', 'graph TD\n  A【text】--> B[text]'],
  ['full-width colon ：in sequence msg', 'sequenceDiagram\n  A->>B：消息'],
  ['full-width semicolon ；', 'sequenceDiagram\n  A->>B: msg；detail'],
  ['full-width comma ，', 'graph TD\n  A[数据，信息] --> B'],
  ['full-width period 。', 'graph TD\n  A[数据。信息] --> B'],
  ['full-width arrow →', 'graph TD\n  A → B'],
  ['full-width exclamation ！', 'graph TD\n  A[注意！] --> B'],
  ['full-width question ？', 'graph TD\n  A[问题？] --> B'],
  ['full-width tilde ～', 'graph TD\n  A[范围～50万] --> B'],
  ['full-width equals ＝', 'graph TD\n  A[条件＝true] --> B'],
  ['full-width plus ＋', 'graph TD\n  A[加＋减] --> B'],
  ['full-width minus —', 'graph TD\n  A[从—到] --> B'],
  ['full-width slash ／', 'graph TD\n  A[路径／文件] --> B'],
  ['full-width backslash ＼', 'graph TD\n  A[路径＼文件] --> B'],
  ['full-width at ＠', 'graph TD\n  A[＠用户] --> B'],
  ['full-width hash ＃', 'graph TD\n  A[＃标签] --> B'],
  ['full-width percent ％', 'graph TD\n  A[％比] --> B'],
  ['full-width ampersand ＆', 'graph TD\n  A[＆合并] --> B'],
  ['full-width asterisk ＊', 'graph TD\n  A[＊通配] --> B'],
  ['full-width pipe ｜', 'graph TD\n  A[｜管道] --> B'],
  ['full-width less ＜ greater ＞', 'graph TD\n  A[＜条件＞] --> B'],
  ['full-width underscore ＿', 'graph TD\n  A[变量＿名] --> B'],
  ['full-width space (ideographic)', 'graph TD\n  A[数据　信息] --> B'],
  ['full-width angle brackets 《》', 'graph TD\n  A[《标题》] --> B'],
  ['full-width single quotes \u2018\u2019', "graph TD\n  A[\u2018中文\u2019] --> B"],
  ['full-width double quotes \u201c\u201d', 'graph TD\n  A[\u201c中文\u201d] --> B'],

  // === SMART/SMART QUOTES (already in labels) ===
  ['smart double quotes in label', 'graph TD\n  A[\u201c中文\u201d] --> B'],
  ['smart single quotes in label', "graph TD\n  A[\u2018中文\u2019] --> B"],
  ['smart quotes in sequence message', 'sequenceDiagram\n  A->>B: \u201c消息\u201d'],
  ['smart quotes as string delimiter (not in [])', 'graph TD\n  A-->\u201cB\u201d'],

  // === HTML MIXED ===
  ['br tag in node label', 'graph TD\n  A[text<br/>more] --> B'],
  ['br tag without slash', 'graph TD\n  A[text<br>more] --> B'],
  ['br with style', 'graph TD\n  A[text<br style="color:red"/>more] --> B'],
  ['nbsp entity in node', 'graph TD\n  A[text&nbsp;more] --> B'],
  ['div in node', 'graph TD\n  A[text<div>more</div>] --> B'],
  ['span in node', 'graph TD\n  A[text<span>more</span>] --> B'],
  ['b tag in node', 'graph TD\n  A[<b>bold</b> text] --> B'],
  ['i tag in node', 'graph TD\n  A[<i>italic</i> text] --> B'],
  ['em tag in node', 'graph TD\n  A[<em>emphasis</em> text] --> B'],
  ['img tag in node', 'graph TD\n  A[<img src="x"/> text] --> B'],
  ['script tag (XSS attempt)', 'graph TD\n  A[<script>alert(1)</script>] --> B'],
  ['a href in node', 'graph TD\n  A[<a href="x">link</a>] --> B'],

  // === ARROW SYNTAX ===
  ['->>> (3 arrows in seq)', 'sequenceDiagram\n  A->>>B: msg'],
  ['--->> (4 dashes in seq)', 'sequenceDiagram\n  A--->>B: msg'],
  ['->> correct (seq)', 'sequenceDiagram\n  A->>B: msg'],
  ['-->> correct (seq)', 'sequenceDiagram\n  A-->>B: msg'],
  ['->> in graph (should be -->>)', 'graph TD\n  A ->> B'],
  ['--> correct (graph)', 'graph TD\n  A --> B'],
  ['-->> correct (graph)', 'graph TD\n  A -->> B'],
  ['-> (solid in graph)', 'graph TD\n  A -> B'],
  ['=> (invalid arrow)', 'graph TD\n  A => B'],
  ['== (invalid arrow combo -x>', 'graph TD\n  A -x> B'],

  // === COMMON AGENT ERRORS ===
  ['missing end for subgraph', 'graph TD\n  subgraph S\n    A --> B'],
  ['double end for subgraph', 'graph TD\n  subgraph S\n    A --> B\n  end\n  end'],
  ['@startuml in mermaid', '@startuml\n  A --> B'],
  ['markdown bold in node', 'graph TD\n  A[**bold** text] --> B'],
  ['markdown italic in node', 'graph TD\n  A[*italic* text] --> B'],
  ['markdown link in node', 'graph TD\n  A[[link](url)] --> B'],
  ['incomplete gitgraph (user error #1)', 'gitGraph\n  commit id: "v0.10.0" commit id: "A" branch fix/ci-merge checkout fix/ci-merge commit id: "B1"'],
  ['sequenceDiagram missing newline (user error #2)', 'sequenceDiagram\n  participant main\n  participant GitHub\n  main->>GitHub: commit 立刻落到 main\n  GitHub-->>GitHub: CI 开始跑'],
  ['graph TBsubgraph Chinese (user error #5)', 'graph TBsubgraph 一期 ~50万\n  B1[数据汇聚治理中台] --> C1[数据汇聚]'],
  ['graph TBsubgraph Chinese v2 (user error #6)', 'graph TBsubgraph 一期 ~90万\n  C1[数据汇聚] --> D1[数据治理]'],

  // === WHITESPACE ===
  ['tab indentation', 'graph TD\n\tA --> B\n\tB --> C'],
  ['mixed tab+space', 'graph TD\n  A --> B\n\tB --> C'],
  ['trailing spaces on lines', 'graph TD\n  A --> B   \n  B --> C   '],
  ['CRLF line endings', 'graph TD\r\n  A --> B\r\n  B --> C'],
  ['no space after graph TD', 'graph TD\nA-->B'],
  ['extra blank lines', 'graph TD\n\n\n  A --> B\n\n\n  B --> C'],
  ['BOM at start', '\uFEFFgraph TD\n  A --> B'],

  // === NODE SYNTAX ===
  ['unmatched bracket in label', 'graph TD\n  A[text with [bracket] --> B'],
  ['unmatched paren in label', 'graph TD\n  A(text with (paren) --> B'],
  ['empty node label', 'graph TD\n  A[] --> B'],
  ['node with #quot; entity', 'graph TD\n  A[#quot;quoted#quot;] --> B'],
  ['node with newline in label', 'graph TD\n  A[line1\\nline2] --> B'],

  // === SUBGRAPH SYNTAX ===
  ['subgraph with square brackets', 'graph TD\n  subgraph S [Title]\n    A --> B\n  end'],
  ['subgraph without title', 'graph TD\n  subgraph S\n    A --> B\n  end'],
  ['nested subgraph', 'graph TD\n  subgraph S1\n    subgraph S2\n      A --> B\n    end\n  end'],
  ['subgraph direction', 'graph TD\n  subgraph S\n    direction LR\n    A --> B\n  end'],

  // === EDGE CASES ===
  ['empty diagram', ''],
  ['only whitespace', '   \n  \n  '],
  ['just a keyword', 'graph'],
  ['keyword with no content', 'graph TD'],
  ['very long label', 'graph TD\n  A[' + 'x'.repeat(500) + '] --> B'],
  ['unicode emoji in label', 'graph TD\n  A[🎉 emoji] --> B'],
  ['null byte in code', 'graph TD\n  A --> \u0000B'],
];

async function run() {
  console.log('STATUS\tNAME\tERROR');
  for (const [name, code] of tests) {
    try {
      await mmd.parse(code);
      console.log(`PASS\t${name}\t`);
    } catch(e) {
      const msg = (e.message || String(e)).replace(/\n/g, ' ').replace(/\t/g, ' ').substring(0, 150);
      console.log(`FAIL\t${name}\t${msg}`);
    }
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
