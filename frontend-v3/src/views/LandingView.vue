<template>
  <div class="stage">
    <div class="glow"></div>
    <div class="grid-bg"></div>

    <div class="wrap">
      <nav>
        <router-link to="/" class="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="word">PeekView</span>
        </router-link>
        <div class="nav-links">
          <a href="https://github.com/randomgitsrc/peekview" target="_blank" rel="noopener">GitHub</a>
          <a href="https://pypi.org/project/peekview/" target="_blank" rel="noopener">PyPI</a>
          <a href="https://www.npmjs.com/package/@peekview/mcp-server" target="_blank" rel="noopener">npm</a>
          <a href="https://github.com/randomgitsrc/peekview/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Changelog</a>
        </div>
        <div class="nav-cta">
          <button class="btn btn-ghost btn-sm" @click="showLogin = true">Sign in</button>
          <router-link to="/explore" class="btn btn-primary btn-sm">Explore</router-link>
        </div>
      </nav>

      <!-- HERO -->
      <section class="hero">
        <span class="eyebrow"><span class="dot"></span>Code · Docs · Data · HTML</span>
        <h1>Read the machine.</h1>
        <p class="sub">Your agents generate code, docs and data around the clock. PeekView renders every artifact into a fast, beautiful view you can share with one link — readable by humans and agents alike.</p>
        <div class="hero-cta">
          <router-link to="/explore" class="btn btn-primary">Start viewing</router-link>
          <span class="cmd"><span><span class="pr">$</span> pipx install peekview</span>
            <span class="copy" title="Copy" @click="copyCmd('pipx install peekview')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            </span>
          </span>
        </div>
        <p class="hero-note">For humans. Wiring up an agent? <a href="#access">Connect the MCP server →</a></p>

        <div class="preview-wrap">
          <div class="window">
            <div class="titlebar">
              <span class="dots"><i style="background:#ff5f57"/><i style="background:#febc2e"/><i style="background:#28c840"/></span>
              <span class="urlbar">peekview.dev/p/agent-runbook</span>
            </div>
            <div class="viewer">
              <div class="filetree">
                <div class="ft-h">Files</div>
                <div class="ft-row active">README.md</div>
                <div class="ft-row">architecture.mmd</div>
                <div class="ft-row">auth.py</div>
                <div class="ft-row">schema.svg</div>
                <div class="ft-row">metrics.csv</div>
                <div class="ft-row">index.html</div>
              </div>
              <div class="doc">
                <div class="md-h1">Agent Runbook</div>
                <div class="md-meta">README.md · rendered with Mermaid</div>
                <div class="md-p">The planner loops until the task reads complete. Every step is logged, rendered and published to PeekView — for humans and agents to review.</div>
                <div class="diagram">
                  <span class="node">Plan</span><span class="arrow"></span><span class="node">Act</span><span class="arrow"></span><span class="node">Observe</span>
                </div>
                <div class="md-code"><span class="cm"># fenced code, diagrams &amp; SVG all render inline</span><br/><span class="kw">def</span> <span class="fn">step</span>(state): <span class="kw">return</span> plan(state)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ACCESS: TWO FRONT DOORS -->
      <section class="access" id="access">
        <div class="sec-head">
          <span class="eyebrow"><span class="dot"></span>One viewer · Two ways to publish</span>
          <h2>Get agent output published.</h2>
          <p>Your agents do the producing. PeekView gives their output two entry points — push it from a terminal or straight from the agent — and every link lands in the same viewer, read by humans and agents alike.</p>
        </div>
        <div class="door-grid">
          <div class="door">
            <span class="tag"><span class="dot"></span>peekview · CLI &amp; app</span>
            <h3>From your terminal</h3>
            <p>You, your scripts and your CI install the CLI or open the web app, drop in code, docs or data, and get a shareable link back in milliseconds.</p>
            <span class="cmd"><span><span class="pr">$</span> pipx install peekview</span>
              <span class="copy" title="Copy" @click="copyCmd('pipx install peekview')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>
            </span>
            <span class="who">Best for developers, teams &amp; pipelines</span>
          </div>
          <div class="door">
            <span class="tag"><span class="dot"></span>peekview-mcp · MCP server</span>
            <h3>From your agent</h3>
            <p>Connect PeekView to Claude, Cursor or any MCP client. Your agent calls one tool to publish its own output — no human running a command, no copy-paste.</p>
            <span class="cmd"><span><span class="pr">$</span> npm install -g @peekview/mcp-server</span>
              <span class="copy" title="Copy" @click="copyCmd('npm install -g @peekview/mcp-server')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>
            </span>
            <span class="who">Best for autonomous agents and IDEs</span>
          </div>
        </div>
      </section>

      <!-- FORMATS -->
      <section class="formats">
        <div class="sec-head">
          <span class="eyebrow"><span class="dot"></span>Renders everything they make</span>
          <h2>Not just code.</h2>
          <p>Agents emit far more than Python. PeekView renders the whole spread — prose, diagrams, markup, vectors and data — each in its native, legible form.</p>
        </div>
        <div class="fmt-grid">
          <div class="fmt"><div class="render" v-html="codeFmt"/><div class="lbl"><div class="name">Code</div><div class="types">40+ languages · highlighted</div></div></div>
          <div class="fmt"><div class="render" v-html="mdFmt"/><div class="lbl"><div class="name">Markdown</div><div class="types">GFM · math · footnotes</div></div></div>
          <div class="fmt"><div class="render" v-html="diagramFmt"/><div class="lbl"><div class="name">Diagrams</div><div class="types">Mermaid · PlantUML</div></div></div>
          <div class="fmt"><div class="render" v-html="htmlFmt"/><div class="lbl"><div class="name">HTML &amp; web</div><div class="types">Live, sandboxed preview</div></div></div>
          <div class="fmt"><div class="render" v-html="svgFmt"/><div class="lbl"><div class="name">SVG &amp; images</div><div class="types">PNG · JPG · SVG · WebP</div></div></div>
          <div class="fmt"><div class="render" v-html="dataFmt"/><div class="lbl"><div class="name">Data</div><div class="types">JSON · CSV · tables</div></div></div>
        </div>
      </section>

      <!-- FEATURES -->
      <section class="features">
        <div class="sec-head">
          <span class="eyebrow"><span class="dot"></span>Why PeekView</span>
          <h2>Built for how agents ship.</h2>
          <p>Agents produce faster than anyone can read. PeekView is the layer that makes their output legible — and shareable.</p>
        </div>
        <div class="feat-grid">
          <div class="feat">
            <span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg></span>
            <h3>Publish from anywhere</h3>
            <p>One <code>peekview create</code>, REST call or MCP tool and your artifact is live in milliseconds — straight from the script, pipeline or agent that made it.</p>
          </div>
          <div class="feat">
            <span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/></svg></span>
            <h3>Read by humans and agents</h3>
            <p>Every view is clean for people and structured for machines — fetch the same URL back as rendered HTML, Markdown or JSON. One artifact, two audiences.</p>
          </div>
          <div class="feat">
            <span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></span>
            <h3>Shareable by link</h3>
            <p>Public or private, with optional expiry and <code>pv_</code> access keys. One URL your teammates — and other agents — can open and read.</p>
          </div>
        </div>

        <div class="flow">
          <div class="step"><div class="k">01 / CREATE</div><div class="t">Agent publishes</div><div class="d">CLI, API or MCP pushes code, docs or data to PeekView.</div></div>
          <div class="step"><div class="k">02 / RENDER</div><div class="t">PeekView formats</div><div class="d">Highlighted, structured, searchable — instantly.</div></div>
          <div class="step"><div class="k">03 / VIEW</div><div class="t">Anyone reads</div><div class="d">A single link, legible to humans and agents alike.</div></div>
        </div>
      </section>

      <!-- CTA BAND -->
      <section class="cta-band">
        <h2>Give agent output a place to live.</h2>
        <p>Self-hosted, open source, ready in one command.</p>
        <div class="hero-cta">
          <router-link to="/explore" class="btn btn-primary">Explore</router-link>
          <a href="https://github.com/randomgitsrc/peekview" target="_blank" rel="noopener" class="btn btn-ghost">Read the docs</a>
        </div>
      </section>
    </div>

    <footer>
      <div class="wrap foot">
        <router-link to="/" class="brand">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="word">PeekView</span>
        </router-link>
        <div class="links">
          <a href="https://github.com/randomgitsrc/peekview" target="_blank" rel="noopener">GitHub</a>
          <a href="https://pypi.org/project/peekview/" target="_blank" rel="noopener">PyPI</a>
          <a href="https://www.npmjs.com/package/@peekview/mcp-server" target="_blank" rel="noopener">npm</a>
          <a href="https://github.com/randomgitsrc/peekview/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Changelog</a>
        </div>
        <div class="meta"><span class="v">v0.2.5</span><span>·</span><span>© 2026 PeekView</span></div>
      </div>
    </footer>

    <LoginDialog v-model:visible="showLogin" :allow-registration="true" />
    <ThemeToggle class="theme-fab" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import LoginDialog from '@/components/LoginDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const router = useRouter()
const { authState } = storeToRefs(useAuthStore())
const showLogin = ref(false)

const SEO_TITLE = 'PeekView — Read the machine'
const SEO_DESC = 'Your agents generate code, docs and data around the clock. PeekView renders every artifact into a fast, beautiful view you can share with one link.'

function injectMeta() {
  document.title = SEO_TITLE
  const m = (n: string, v: string, p?: string) => { const el = document.createElement('meta'); el.setAttribute(n, v); if (p) el.setAttribute('property', p); el.setAttribute('data-peekview-landing', ''); document.head.appendChild(el) }
  m('name', 'description'); m('property', 'og:title'); m('property', 'og:description')
  document.querySelectorAll('[data-peekview-landing]').forEach(el => { if (el.getAttribute('property') === 'og:title') el.setAttribute('content', 'PeekView'); else if (el.getAttribute('property') === 'og:description' || el.getAttribute('name') === 'description') el.setAttribute('content', SEO_DESC) })
}
function removeMeta() { document.querySelectorAll('[data-peekview-landing]').forEach(el => el.remove()); document.title = 'PeekView' }

async function copyCmd(text: string) { try { await navigator.clipboard.writeText(text) } catch {} }

watch(authState, (state) => { if (state === 'authenticated') router.replace('/explore') })
onMounted(() => { injectMeta() })
onUnmounted(() => { removeMeta() })

const codeFmt = `<div style="font-family:var(--font-mono);font-size:12px;line-height:1.95;color:var(--c-muted)"><span class="kw">export</span> <span class="kw">async function</span> <span class="fn">run</span>() {<br/>&nbsp;&nbsp;<span class="kw">const</span> res = <span class="kw">await</span> <span class="fn">fetch</span>(url);<br/>&nbsp;&nbsp;<span class="kw">return</span> res.<span class="fn">json</span>();<br/>}</div>`
const mdFmt = `<div><div class="bar hd"></div>${new Array(3).fill('<div class="bar"></div>').join('')}<div class="md-bullet"><span class="md-bullet-dot"/><div class="bar"/></div><div class="md-bullet"><span class="md-bullet-dot"/><div class="bar" style="width:52%"/></div></div>`
const diagramFmt = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px"><span class="node" style="font-size:11px;padding:7px 13px">Start</span><span style="width:2px;height:13px;background:var(--c-border2);display:block"></span><span class="node" style="font-size:11px;padding:7px 13px">Decide</span><span style="width:2px;height:13px;background:var(--c-border2);display:block"></span><span class="node" style="font-size:11px;padding:7px 13px">Ship</span></div>`
const htmlFmt = `<div style="display:flex;flex-direction:column;gap:11px;justify-content:center"><div class="bar hd"></div><div style="height:36px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-panel)"></div><span style="display:inline-flex;align-self:flex-start;height:27px;padding:0 15px;align-items:center;border-radius:7px;background:var(--c-accent);color:#fff;font-size:12px;font-weight:600">Button</span></div>`
const svgFmt = `<div style="display:flex;align-items:center;justify-content:center"><div style="width:100%;height:100%;border-radius:9px;border:1px solid var(--c-border);background-image:repeating-linear-gradient(45deg,var(--c-border) 0 1px,transparent 1px 10px);display:flex;align-items:center;justify-content:center"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent2)" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></svg></div></div>`
const dataFmt = `<div style="display:flex;align-items:center;justify-content:center"><div style="width:100%;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:1px;border:1px solid var(--c-border);border-radius:7px;overflow:hidden;font-family:var(--font-mono);font-size:11px"><div style="background:rgba(77,141,255,.12);color:var(--c-accent2);padding:7px 9px;font-weight:600">name</div><div style="background:rgba(77,141,255,.12);color:var(--c-accent2);padding:7px 9px;font-weight:600">runs</div><div style="background:rgba(77,141,255,.12);color:var(--c-accent2);padding:7px 9px;font-weight:600">ok</div><div style="background:var(--c-panel2);color:var(--c-muted);padding:7px 9px">plan</div><div style="background:var(--c-panel2);color:var(--c-muted);padding:7px 9px">128</div><div style="background:var(--c-panel2);color:#7ee787;padding:7px 9px">✓</div><div style="background:var(--c-panel2);color:var(--c-muted);padding:7px 9px">act</div><div style="background:var(--c-panel2);color:var(--c-muted);padding:7px 9px">96</div><div style="background:var(--c-panel2);color:#7ee787;padding:7px 9px">✓</div></div></div>`
</script>

<style>
.stage,
[data-theme="dark"] .stage {
  --c-bg:#0a0d13;--c-panel:#121822;--c-panel2:#0e131b;
  --c-border:rgba(255,255,255,.08);--c-border2:rgba(255,255,255,.13);
  --c-text:#e9eef4;--c-muted:#9aa7b4;--c-faint:#6a7682;
  --c-accent:#4d8dff;--c-accent2:#76a6ff;
  --c-hero-grad:linear-gradient(180deg,#ffffff 30%,#b9c6d4 100%);
  --c-cta-grad:linear-gradient(180deg,#fff 40%,#aebccb 100%);
  --glow-color:rgba(77,141,255,.20);
}
[data-theme="light"] .stage {
  --c-bg:#f6f8fa;--c-panel:#ffffff;--c-panel2:#f0f2f5;
  --c-border:rgba(0,0,0,.08);--c-border2:rgba(0,0,0,.13);
  --c-text:#1f2328;--c-muted:#656d76;--c-faint:#8c959f;
  --c-accent:#0969da;--c-accent2:#0550ae;
  --c-hero-grad:linear-gradient(180deg,#1f2328 30%,#656d76 100%);
  --c-cta-grad:linear-gradient(180deg,#1f2328 40%,#656d76 100%);
  --glow-color:rgba(9,105,218,.12);
}
</style>

<style scoped>
* { box-sizing:border-box }
.stage { position:relative;isolation:isolate;background:var(--c-bg);color:var(--c-text);font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh }
a { color:inherit;text-decoration:none }
.glow { position:absolute;top:-260px;left:50%;transform:translateX(-50%);width:1100px;height:720px;z-index:-1;pointer-events:none;background:radial-gradient(50% 50% at 50% 50%,var(--glow-color) 0%,rgba(77,141,255,.06) 40%,transparent 70%);filter:blur(8px) }
.grid-bg { position:absolute;inset:0;z-index:-2;pointer-events:none;background-image:linear-gradient(var(--c-border) 1px,transparent 1px),linear-gradient(90deg,var(--c-border) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(70% 55% at 50% 30%,#000 0%,transparent 75%);-webkit-mask-image:radial-gradient(70% 55% at 50% 30%,#000 0%,transparent 75%);opacity:.5 }
.wrap { max-width:1120px;margin:0 auto;padding:0 32px }
.theme-fab { position:absolute;top:16px;right:16px;z-index:10 }

/* nav */
nav { display:flex;align-items:center;justify-content:space-between;height:72px }
.brand { display:flex;align-items:center;gap:11px }
.word { font-size:21px;font-weight:700;letter-spacing:-0.02em }
.nav-links { display:flex;align-items:center;gap:30px }
.nav-links a { font-size:14px;color:var(--c-muted);transition:color .15s }
.nav-links a:hover { color:var(--c-text) }
.nav-cta { display:flex;align-items:center;gap:14px }

.btn { display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border-radius:8px;font-size:14px;font-weight:600;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap }
.btn-primary { background:var(--c-accent);color:#fff;box-shadow:0 6px 20px rgba(77,141,255,.35) }
.btn-primary:hover { background:var(--c-accent2) }
.btn-ghost { background:transparent;color:var(--c-text);border-color:var(--c-border2) }
.btn-ghost:hover { background:var(--c-border);border-color:var(--c-muted) }
.btn-sm { height:34px;padding:0 14px;font-size:13px }

/* hero */
.hero { text-align:center;padding:64px 0 0 }
.eyebrow { display:inline-flex;align-items:center;gap:10px;margin-bottom:26px;font-family:var(--font-mono);font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.18em;color:var(--c-accent2) }
.eyebrow .dot { width:6px;height:6px;border-radius:50%;background:var(--c-accent);box-shadow:0 0 12px var(--c-accent) }
h1 { margin:0;font-size:76px;line-height:1.02;font-weight:700;letter-spacing:-.035em;background:var(--c-hero-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent }
.sub { max-width:620px;margin:26px auto 0;font-size:19px;line-height:1.6;color:var(--c-muted);text-wrap:balance }
.hero-cta { display:flex;align-items:center;justify-content:center;gap:14px;margin-top:36px;flex-wrap:wrap }
.cmd { display:inline-flex;align-items:center;gap:12px;height:40px;padding:0 8px 0 16px;border-radius:8px;border:1px solid var(--c-border2);background:var(--c-panel2);font-family:var(--font-mono);font-size:13.5px;color:var(--c-text) }
.pr { color:var(--c-accent2) }
.copy { display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;color:var(--c-faint);border:1px solid transparent;cursor:pointer }
.copy:hover { color:var(--c-text);background:var(--c-border) }
.hero-note { margin:18px 0 0;font-size:13.5px;color:var(--c-faint) }
.hero-note a { color:var(--c-accent2);border-bottom:1px solid transparent;transition:border-color .15s }
.hero-note a:hover { border-color:var(--c-accent2) }

/* preview window — always dark */
.preview-wrap { margin:68px auto 0;max-width:980px;perspective:1600px }
.window { border-radius:13px;overflow:hidden;border:1px solid rgba(255,255,255,.13);background:#0d1117;box-shadow:0 40px 90px -30px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.02) }
.titlebar { display:flex;align-items:center;gap:14px;height:44px;padding:0 16px;background:#161b22;border-bottom:1px solid rgba(255,255,255,.08) }
.dots { display:flex;gap:8px }
.dots i { width:12px;height:12px;border-radius:50%;display:block }
.urlbar { flex:1;max-width:360px;margin:0 auto;height:26px;border-radius:6px;background:#0d1117;border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;gap:7px;font-family:var(--font-mono);font-size:12px;color:#6a7682 }
.viewer { display:grid;grid-template-columns:200px 1fr;min-height:340px }
.filetree { background:#11161e;border-right:1px solid rgba(255,255,255,.08);padding:14px 10px }
.ft-h { font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6a7682;padding:0 8px 10px;font-weight:600 }
.ft-row { display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-family:var(--font-mono);font-size:13px;color:#9aa7b4 }
.ft-row.active { background:rgba(77,141,255,.14);color:#76a6ff }
.doc { padding:26px 30px;overflow:hidden }
.doc .md-h1 { font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0 0 4px;color:#e9eef4 }
.doc .md-meta { font-family:var(--font-mono);font-size:11.5px;color:#6a7682;margin-bottom:18px }
.doc .md-p { font-size:14px;line-height:1.65;color:#9aa7b4;margin:0 0 18px;max-width:54ch }
.diagram { border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d1117;padding:22px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:0;margin-bottom:16px }
.node { padding:9px 15px;border-radius:8px;border:1px solid rgba(77,141,255,.35);background:rgba(77,141,255,.1);color:#76a6ff;font-family:var(--font-mono);font-size:12.5px;white-space:nowrap }
.arrow { width:38px;height:2px;background:rgba(255,255,255,.13);position:relative }
.arrow::after { content:'';position:absolute;right:-1px;top:50%;transform:translateY(-50%);border-left:6px solid rgba(255,255,255,.13);border-top:4px solid transparent;border-bottom:4px solid transparent }
.md-code { border:1px solid rgba(255,255,255,.08);border-radius:10px;background:#0d1117;padding:13px 16px;font-family:var(--font-mono);font-size:12.5px;line-height:1.75;color:#9aa7b4;white-space:pre-wrap }
.cm { color:#586573 } .kw { color:#ff7b9c } .fn { color:#6cd0ff }

/* access */
.access { padding:130px 0 0 }
.sec-head { text-align:center;margin-bottom:56px }
.sec-head .eyebrow { margin-bottom:18px }
.sec-head h2 { margin:0;font-size:38px;font-weight:700;letter-spacing:-.025em }
.sec-head p { margin:14px auto 0;max-width:540px;color:var(--c-muted);font-size:17px;line-height:1.6 }
.door-grid { display:grid;grid-template-columns:1fr 1fr;gap:20px }
.door { padding:32px;border-radius:14px;border:1px solid var(--c-border);background:linear-gradient(180deg,var(--c-panel) 0%,var(--c-panel2) 100%);display:flex;flex-direction:column }
.door .tag { display:inline-flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--c-accent2) }
.door .tag .dot { width:6px;height:6px;border-radius:50%;background:var(--c-accent);box-shadow:0 0 10px var(--c-accent) }
.door h3 { margin:16px 0 9px;font-size:21px;font-weight:650;letter-spacing:-.015em }
.door p { margin:0 0 24px;font-size:14.5px;line-height:1.62;color:var(--c-muted);flex:1 }
.door .cmd { align-self:flex-start }
.door .who { margin-top:14px;font-size:12.5px;color:var(--c-faint) }

/* formats */
.formats { padding:120px 0 0 }
.fmt-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:20px }
.fmt { border:1px solid var(--c-border);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--c-panel) 0%,var(--c-panel2) 100%);transition:border-color .2s,transform .2s;display:flex;flex-direction:column }
.fmt:hover { border-color:var(--c-border2);transform:translateY(-3px) }
.fmt .render { height:156px;padding:18px;border-bottom:1px solid var(--c-border);overflow:hidden }
[data-theme="dark"] .fmt .render { background:#0d1117 }
[data-theme="light"] .fmt .render { background:#f6f8fa }
.fmt .render .bar { border-radius:3px;background:var(--c-border) }
.fmt .render .bar.hd { background:var(--c-border2);width:52%;height:11px;margin-bottom:13px }
.fmt .render .bar:not(.hd) { width:100%;height:7px;margin-bottom:7px }
.fmt .render .md-bullet { display:flex;gap:9px;align-items:center;margin-bottom:9px }
.fmt .render .md-bullet-dot { width:5px;height:5px;border-radius:50%;background:var(--c-accent2);flex:none }
.fmt .render .md-bullet .bar { width:64%;margin:0 }
.fmt .render .vbar { width:2px;height:13px;background:var(--c-border2);display:block }
.fmt .render .html-box { height:36px;border-radius:8px;border:1px solid var(--c-border);background:var(--c-panel);margin-bottom:11px;width:100% }
.fmt .render .html-btn { display:inline-flex;align-self:flex-start;height:27px;padding:0 15px;align-items:center;border-radius:7px;background:var(--c-accent);color:#fff;font-size:12px;font-weight:600 }
.fmt .render svg { color:var(--c-accent2) }
.fmt .lbl { padding:16px 20px 20px }
.fmt .lbl .name { font-size:15.5px;font-weight:650;letter-spacing:-.01em }
.fmt .lbl .types { margin-top:5px;font-family:var(--font-mono);font-size:12px;color:var(--c-faint) }
.l-table { width:100%;border-collapse:collapse;font-family:var(--font-mono);font-size:11px }
.l-table th { background:rgba(77,141,255,.12);color:var(--c-accent2);padding:7px 9px;text-align:left;font-weight:600 }
[data-theme="dark"] .l-table td { background:#0d1117 }
[data-theme="light"] .l-table td { background:#f6f8fa }
.l-table td { color:var(--c-muted);padding:7px 9px }
.l-table .ok { color:#7ee787 }

/* features */
.features { padding:96px 0 40px }
.feat-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:20px }
.feat { padding:28px;border-radius:14px;border:1px solid var(--c-border);background:linear-gradient(180deg,var(--c-panel) 0%,var(--c-panel2) 100%);transition:border-color .2s,transform .2s }
.feat:hover { border-color:var(--c-border2);transform:translateY(-3px) }
.feat .ico { display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:11px;background:rgba(77,141,255,.12);border:1px solid rgba(77,141,255,.25);color:var(--c-accent2);margin-bottom:20px }
.feat h3 { margin:0 0 9px;font-size:18px;font-weight:650;letter-spacing:-.01em }
.feat p { margin:0;font-size:14.5px;line-height:1.62;color:var(--c-muted) }
.feat code { font-family:var(--font-mono);font-size:.92em;color:var(--c-accent2) }
.flow { display:flex;align-items:stretch;gap:0;margin-top:64px;border:1px solid var(--c-border);border-radius:14px;overflow:hidden }
.flow .step { flex:1;padding:26px 28px }
.flow .step+.step { border-left:1px solid var(--c-border) }
.flow .k { font-family:var(--font-mono);font-size:12px;color:var(--c-accent2);letter-spacing:.06em }
.flow .t { margin-top:10px;font-size:15px;font-weight:600 }
.flow .d { margin-top:6px;font-size:13.5px;color:var(--c-muted);line-height:1.55 }

/* cta band */
.cta-band { text-align:center;padding:120px 0 100px }
.cta-band h2 { font-size:46px;font-weight:700;letter-spacing:-.03em;margin:0 0 14px;background:var(--c-cta-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent }
.cta-band p { color:var(--c-muted);font-size:18px;margin:0 0 32px }

/* footer */
footer { border-top:1px solid var(--c-border);padding:40px 0 }
.foot { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px }
.foot .links { display:flex;gap:26px;font-size:14px;color:var(--c-muted) }
.foot .links a:hover { color:var(--c-text) }
.foot .meta { font-size:13px;color:var(--c-faint);display:flex;align-items:center;gap:12px }
.foot .meta .v { font-family:var(--font-mono) }

@media (max-width:860px) {
  h1 { font-size:48px }
  .nav-links { display:none }
  .viewer { grid-template-columns:1fr }
  .filetree { display:none }
  .feat-grid { grid-template-columns:1fr }
  .door-grid { grid-template-columns:1fr }
  .flow { flex-direction:column }
  .flow .step+.step { border-left:none;border-top:1px solid var(--c-border) }
  .sub { font-size:17px }
  .cta-band h2 { font-size:34px }
  .fmt-grid { grid-template-columns:1fr }
}
</style>
