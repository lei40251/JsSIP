#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadMarked() {
  try {
    return require('marked');
  } catch (_) {
    const userProfile = process.env.USERPROFILE;
    const bundled = userProfile && path.join(
      userProfile,
      '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/marked'
    );
    if (bundled && fs.existsSync(bundled)) return require(bundled);
    throw new Error('找不到 marked。请安装 marked，或在 Codex bundled Node 环境运行。');
  }
}

const { marked, Renderer } = loadMarked();
const root = __dirname;
const outputDir = path.join(root, 'html');
const assetsDir = path.join(outputDir, 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

for (const name of fs.readdirSync(outputDir)) {
  if (name.endsWith('.html')) fs.unlinkSync(path.join(outputDir, name));
}

const markdownFiles = fs.readdirSync(root)
  .filter((name) => name.endsWith('.md'))
  .sort((a, b) => {
    if (a === 'README.md') return -1;
    if (b === 'README.md') return 1;
    const rank = (name) => {
      const main = name.match(/^(\d{2})-/);
      if (main) return Number(main[1]);
      const appendix = name.match(/^Appendix-([A-F])-/);
      if (appendix) return 100 + appendix[1].charCodeAt(0);
      return 1000;
    };
    return rank(a) - rank(b) || a.localeCompare(b, 'zh-CN', { numeric: true });
  });

function stripMarkdown(value) {
  return value
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~`>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function outputName(markdownName) {
  return markdownName === 'README.md'
    ? 'index.html'
    : `${path.basename(markdownName, '.md')}.html`;
}

const navTitles = {
  'README.md': '文档首页',
  '00-Reading-Guide-and-Source-Map.md': '00 阅读说明与源码地图',
  '01-Browser-API-Panorama.md': '01 浏览器 API 全景',
  '02-RTCPeerConnection-usage-analysis.md': '02 RTCPeerConnection',
  '03-WebSocket-usage-analysis.md': '03 WebSocket 信令',
  '04-MediaDevices-and-Capture.md': '04 MediaDevices 与采集',
  '05-MediaStreamTrack-Lifecycle.md': '05 Track 生命周期',
  '06-Web-Audio-usage-analysis.md': '06 Web Audio',
  '07-Media-Playback-and-Rendering.md': '07 播放与渲染',
  '08-Worker-Streams-and-Encoded-Processing.md': '08 Worker 与编码帧',
  '09-WebCodecs-and-WebAssembly.md': '09 WebCodecs 与 WASM',
  '10-Auxiliary-Browser-APIs.md': '10 辅助浏览器 API',
  '11-End-to-End-Business-Flows.md': '11 端到端业务流程',
  'Appendix-A-WebAPI-Occurrences.md': 'A Web API 出现位置',
  'Appendix-B-Source-Method-Index.md': 'B 源码方法索引',
  'Appendix-C-Event-Index.md': 'C 事件索引',
  'Appendix-D-Method-Adjacency-Index.md': 'D 方法调用邻接',
  'Appendix-E-Public-API-Call-Chains.md': 'E 公开 API 调用链',
  'Appendix-F-Visual-Call-Flows.md': 'F 流程图与时序图',
};

const documents = markdownFiles.map((name) => {
  const markdown = fs.readFileSync(path.join(root, name), 'utf8');
  const firstHeading = markdown.match(/^#\s+(.+)$/m);
  const title = stripMarkdown(firstHeading ? firstHeading[1] : path.basename(name, '.md'));
  return {
    name,
    file: outputName(name),
    markdown,
    title,
    navTitle: navTitles[name] || title,
  };
});

function navHtml(activeFile) {
  const learning = documents.filter((doc) => doc.name === 'README.md' || /^(?:0\d|1[01])-/.test(doc.name));
  const indexes = documents.filter((doc) => /^Appendix-[A-F]-/.test(doc.name));
  const group = (label, docs) => `
    <section class="nav-group">
      <h2>${label}</h2>
      ${docs.map((doc) => `
        <a class="nav-link${doc.file === activeFile ? ' active' : ''}" href="${doc.file}">
          ${escapeHtml(doc.navTitle)}
        </a>`).join('')}
    </section>`;
  return group('按顺序阅读', learning) + group('附录（按需查询）', indexes);
}

function transformMarkdownLinks(href) {
  if (href && href.startsWith('html/')) return href.slice('html/'.length);
  if (!href || !/\.md(?:#.*)?$/i.test(href)) return href;
  const hashIndex = href.indexOf('#');
  const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const base = path.basename(rawPath, '.md');
  return `${base === 'README' ? 'index' : base}.html${hash}`;
}

function renderDocument(doc, index) {
  const toc = [];
  const slugs = new Map();
  const renderer = new Renderer();
  const defaultCode = renderer.code.bind(renderer);

  renderer.heading = function({ tokens, depth }) {
    const inner = this.parser.parseInline(tokens);
    const plain = stripMarkdown(inner);
    const base = slugify(plain);
    const count = slugs.get(base) || 0;
    slugs.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    if (depth >= 2 && depth <= 4) toc.push({ depth, id, text: plain });
    return `<h${depth} id="${id}">${inner}<a class="heading-anchor" href="#${id}" aria-label="链接到本节">#</a></h${depth}>\n`;
  };

  renderer.code = function(token) {
    if ((token.lang || '').trim().toLowerCase() === 'mermaid') {
      return `<div class="diagram-block"><div class="diagram-toolbar"><span>流程图</span><button type="button" class="expand-diagram" aria-expanded="false">放大查看</button></div><pre class="mermaid">${escapeHtml(token.text)}</pre></div>\n`;
    }
    const language = (token.lang || 'text').trim();
    return `<div class="code-block"><div class="code-toolbar"><span>${escapeHtml(language)}</span><button type="button" class="copy-code">复制</button></div>${defaultCode(token)}</div>`;
  };

  renderer.link = function({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const target = transformMarkdownLinks(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const external = /^https?:\/\//i.test(target || '');
    return `<a href="${escapeHtml(target || '')}"${titleAttr}${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
  };

  let body = marked.parse(doc.markdown, { gfm: true, renderer });
  body = body
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');

  const previous = documents[index - 1];
  const next = documents[index + 1];
  const tocHtml = toc.length ? `
    <nav class="page-toc" aria-label="本页目录">
      <h2>本页目录</h2>
      ${toc.map((item) => `<a class="toc-depth-${item.depth}" href="#${item.id}">${escapeHtml(item.text)}</a>`).join('')}
    </nav>` : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="TRTC 反混淆源码浏览器 Web API 深度分析：${escapeHtml(doc.title)}">
  <title>${escapeHtml(doc.title)} · TRTC Web API 深度学习</title>
  <link rel="stylesheet" href="assets/docs.css">
  <script>try{const t=localStorage.getItem('trtc-docs-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
  <script src="assets/search-index.js" defer></script>
  <script src="assets/mermaid.min.js" defer></script>
  <script src="assets/docs.js" defer></script>
</head>
<body data-page="${escapeHtml(doc.file)}">
  <header class="topbar">
    <button type="button" class="icon-button nav-toggle" aria-label="打开目录" aria-expanded="false">☰</button>
    <a class="brand" href="index.html">TRTC Web API 深度学习</a>
    <div class="search-shell">
      <label class="sr-only" for="global-search">搜索全部文档</label>
      <input id="global-search" type="search" autocomplete="off" placeholder="搜索 API、方法、事件…" aria-controls="search-results">
      <kbd>/</kbd>
      <div id="search-results" class="search-results" hidden></div>
    </div>
    <a class="source-link" href="../${encodeURIComponent(doc.name)}">Markdown</a>
    <a class="source-link" href="../../trtc.deobfuscated.js">源码</a>
    <button type="button" class="icon-button theme-toggle" aria-label="切换明暗主题">◐</button>
  </header>

  <aside class="sidebar" aria-label="文档目录">
    ${navHtml(doc.file)}
  </aside>
  <div class="sidebar-backdrop" hidden></div>

  <main class="layout">
    <article class="doc-content">
      ${body}
      <nav class="page-pagination" aria-label="上一篇和下一篇">
        ${previous ? `<a class="previous" href="${previous.file}"><span>上一篇</span>${escapeHtml(previous.title)}</a>` : '<span></span>'}
        ${next ? `<a class="next" href="${next.file}"><span>下一篇</span>${escapeHtml(next.title)}</a>` : '<span></span>'}
      </nav>
    </article>
    ${tocHtml}
  </main>
  <button type="button" class="back-to-top" aria-label="回到顶部">↑</button>
</body>
</html>`;
}

documents.forEach((doc, index) => {
  fs.writeFileSync(path.join(outputDir, doc.file), renderDocument(doc, index), 'utf8');
});

const searchEntries = [];
for (const doc of documents) {
  let inFence = false;
  doc.markdown.split('\n').forEach((line, lineIndex) => {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      return;
    }
    const text = stripMarkdown(line);
    if (!text || text.length < 2) return;
    searchEntries.push({
      p: doc.title,
      f: doc.file,
      l: lineIndex + 1,
      t: text,
      c: inFence ? 'code' : 'text',
    });
  });
}

fs.writeFileSync(
  path.join(assetsDir, 'search-index.js'),
  `window.__TRTC_DOC_SEARCH__=${JSON.stringify(searchEntries)};\n`,
  'utf8'
);

const brokenLinks = [];
let mermaidBlocks = 0;
for (const doc of documents) {
  const pagePath = path.join(outputDir, doc.file);
  const html = fs.readFileSync(pagePath, 'utf8');
  mermaidBlocks += (html.match(/<pre class="mermaid">/g) || []).length;
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (!href || href.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(href)) continue;
    const localPath = decodeURIComponent(href.split(/[?#]/)[0]);
    if (!fs.existsSync(path.resolve(outputDir, localPath))) {
      brokenLinks.push(`${doc.file} -> ${href}`);
    }
  }
}

for (const asset of ['docs.css', 'docs.js', 'search-index.js', 'mermaid.min.js']) {
  if (!fs.existsSync(path.join(assetsDir, asset))) brokenLinks.push(`missing asset: ${asset}`);
}

if (brokenLinks.length) {
  throw new Error(`HTML 校验发现无效链接或资源：\n${brokenLinks.join('\n')}`);
}

console.log(
  `Generated ${documents.length} HTML pages, ${searchEntries.length} search entries and ${mermaidBlocks} Mermaid blocks in ${outputDir}`
);
