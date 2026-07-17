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
const sharedAssetsDir = path.resolve(
  root,
  '../../samples/trtc/web-api-deep-dive/html/assets'
);

const userGuideCss = `

/* CRTC user guide navigation controls. */
.nav-toggle { display: inline-block; }
.toc-toggle { display: inline-block; }
.sidebar { transition: transform .2s ease, box-shadow .2s ease; }
.layout { transition: width .2s ease, margin-left .2s ease; }

@media (min-width: 1181px) {
  body.sidebar-collapsed .sidebar { transform: translateX(-105%); box-shadow: none; }
  body.sidebar-collapsed .layout {
    width: min(1500px, 100%);
    margin-left: max(0px, calc((100vw - 1500px) / 2));
  }
  body.sidebar-collapsed .page-toc {
    right: max(38px, calc((100vw - 1500px) / 2 + 38px));
  }
  body.toc-collapsed .layout { grid-template-columns: minmax(0, 1fr); }
  body.toc-collapsed .page-toc { display: none; }
}

@media (min-width: 861px) and (max-width: 1180px) {
  body.sidebar-collapsed .sidebar { transform: translateX(-105%); box-shadow: none; }
  body.sidebar-collapsed .layout { width: 100%; margin-left: 0; }
}

@media (max-width: 1180px) {
  .toc-toggle { display: none; }
}
`;

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`无法生成文档交互：未找到 ${label}`);
  }
  return source.replace(search, replacement);
}

fs.mkdirSync(assetsDir, { recursive: true });

for (const name of fs.readdirSync(outputDir)) {
  if (name.endsWith('.html')) fs.unlinkSync(path.join(outputDir, name));
}

function syncAssets() {
  const docsCss = fs.readFileSync(path.join(sharedAssetsDir, 'docs.css'), 'utf8');
  fs.writeFileSync(path.join(assetsDir, 'docs.css'), docsCss + userGuideCss, 'utf8');
  fs.copyFileSync(
    path.join(sharedAssetsDir, 'mermaid.min.js'),
    path.join(assetsDir, 'mermaid.min.js')
  );
  fs.copyFileSync(
    path.join(sharedAssetsDir, 'mermaid.LICENSE'),
    path.join(assetsDir, 'mermaid.LICENSE')
  );

  let docsJs = fs.readFileSync(path.join(sharedAssetsDir, 'docs.js'), 'utf8')
    .replaceAll('trtc-docs-theme', 'crtc-user-guide-theme')
    .replaceAll('__TRTC_DOC_SEARCH__', '__CRTC_USER_GUIDE_SEARCH__');

  docsJs = replaceRequired(
    docsJs,
    "  const navButton = document.querySelector('.nav-toggle');\n  const sidebar = document.querySelector('.sidebar');",
    "  const navButton = document.querySelector('.nav-toggle');\n  const tocButton = document.querySelector('.toc-toggle');\n  const sidebar = document.querySelector('.sidebar');",
    '目录按钮初始化代码'
  );

  docsJs = replaceRequired(
    docsJs,
    `  function setNav(open) {
    sidebar?.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    navButton?.setAttribute('aria-expanded', String(open));
  }

  navButton?.addEventListener('click', () => setNav(!sidebar?.classList.contains('open')));
  backdrop?.addEventListener('click', () => setNav(false));
  sidebar?.addEventListener('click', (event) => {
    if (event.target.closest('a')) setNav(false);
  });`,
    `  const desktopNav = matchMedia('(min-width: 861px)');

  function setMobileNav(open) {
    sidebar?.classList.toggle('open', open);
    if (backdrop) backdrop.hidden = !open;
    navButton?.setAttribute('aria-expanded', String(open));
    navButton?.setAttribute('aria-label', open ? '收起左侧目录' : '展开左侧目录');
  }

  function syncNavMode() {
    if (desktopNav.matches) {
      sidebar?.classList.remove('open');
      if (backdrop) backdrop.hidden = true;
      const expanded = !document.body.classList.contains('sidebar-collapsed');
      navButton?.setAttribute('aria-expanded', String(expanded));
      navButton?.setAttribute('aria-label', expanded ? '收起左侧目录' : '展开左侧目录');
      return;
    }
    document.body.classList.remove('sidebar-collapsed');
    setMobileNav(false);
  }

  navButton?.addEventListener('click', () => {
    if (desktopNav.matches) {
      document.body.classList.toggle('sidebar-collapsed');
      syncNavMode();
      return;
    }
    setMobileNav(!sidebar?.classList.contains('open'));
  });
  backdrop?.addEventListener('click', () => setMobileNav(false));
  sidebar?.addEventListener('click', (event) => {
    if (!desktopNav.matches && event.target.closest('a')) setMobileNav(false);
  });
  desktopNav.addEventListener?.('change', syncNavMode);
  syncNavMode();

  tocButton?.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('toc-collapsed');
    tocButton.setAttribute('aria-expanded', String(!collapsed));
    tocButton.setAttribute('aria-label', collapsed ? '展开右侧目录' : '收起右侧目录');
  });`,
    '目录开关代码'
  );

  fs.writeFileSync(path.join(assetsDir, 'docs.js'), docsJs, 'utf8');
}

syncAssets();

const markdownFiles = fs.readdirSync(root)
  .filter((name) => name.endsWith('.md'))
  .sort((a, b) => {
    if (a === 'README.md') return -1;
    if (b === 'README.md') return 1;
    const aNumber = Number.parseInt(a, 10);
    const bNumber = Number.parseInt(b, 10);
    return aNumber - bNumber || a.localeCompare(b, 'zh-CN', { numeric: true });
  });

const navTitles = {
  'README.md': '学习指南首页',
  '01-sip-webrtc-basics.md': '1 SIP 与 WebRTC 基础',
  '02-quick-start.md': '2 快速完成第一通电话',
  '03-call-lifecycle.md': '3 注册、通话与事件时序',
  '04-media-features.md': '4 AiNS、虚拟背景与混流',
  '05-call-statistics.md': '5 通话质量统计',
  '06-api-reference.md': '6 SDK API 参考',
  '07-upgrade-guide.md': '7 旧版功能升级指南',
  '08-demo-guide.md': '8 Base JS Demo 学习与验证',
};

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
  return `
    <section class="nav-group">
      ${documents.map((doc) => `
        <a class="nav-link${doc.file === activeFile ? ' active' : ''}" href="${doc.file}">
          ${escapeHtml(doc.navTitle)}
        </a>`).join('')}
    </section>`;
}

function transformMarkdownLinks(href) {
  if (!href || href.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(href)) {
    return href;
  }
  if (/^(?:\.\/)?html\//.test(href)) return href.replace(/^(?:\.\/)?html\//, '');

  const hashIndex = href.indexOf('#');
  const rawPath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  if (/\.md$/i.test(rawPath)) {
    const base = path.basename(rawPath, '.md');
    return `${base === 'README' ? 'index' : base}.html${hash}`;
  }

  return `../${href}`;
}

function renderDocument(doc) {
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
  <meta name="description" content="CRTC Web SDK 系统学习文档：${escapeHtml(doc.title)}">
  <title>${doc.file === 'index.html' ? 'CRTC Web SDK 系统学习指南' : `${escapeHtml(doc.title)} · CRTC Web SDK 系统学习指南`}</title>
  <link rel="stylesheet" href="assets/docs.css">
  <script>try{const t=localStorage.getItem('crtc-user-guide-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
  <script src="assets/search-index.js" defer></script>
  <script src="assets/mermaid.min.js" defer></script>
  <script src="assets/docs.js" defer></script>
</head>
<body data-page="${escapeHtml(doc.file)}">
  <header class="topbar">
    <button type="button" class="icon-button nav-toggle" aria-label="收起左侧目录" aria-expanded="true">☰</button>
    <a class="brand" href="index.html">CRTC Web SDK 系统学习指南</a>
    <div class="search-shell">
      <label class="sr-only" for="global-search">搜索全部文档</label>
      <input id="global-search" type="search" autocomplete="off" placeholder="搜索 API、事件、功能…" aria-controls="search-results">
      <kbd>/</kbd>
      <div id="search-results" class="search-results" hidden></div>
    </div>
    ${toc.length ? '<button type="button" class="icon-button toc-toggle" aria-label="收起右侧目录" aria-expanded="true">◧</button>' : ''}
    <button type="button" class="icon-button theme-toggle" aria-label="切换明暗主题">◐</button>
  </header>

  <aside class="sidebar" aria-label="文档目录">
    ${navHtml(doc.file)}
  </aside>
  <div class="sidebar-backdrop" hidden></div>

  <main class="layout">
    <article class="doc-content">
      ${body}
    </article>
    ${tocHtml}
  </main>
  <button type="button" class="back-to-top" aria-label="回到顶部">↑</button>
</body>
</html>`;
}

documents.forEach((doc) => {
  fs.writeFileSync(path.join(outputDir, doc.file), renderDocument(doc), 'utf8');
});

const searchEntries = [];
for (const doc of documents) {
  let inFence = false;
  doc.markdown.split('\n').forEach((line, lineIndex) => {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      return;
    }
    const entryText = stripMarkdown(line);
    if (!entryText || entryText.length < 2) return;
    searchEntries.push({
      p: doc.title,
      f: doc.file,
      l: lineIndex + 1,
      t: entryText,
      c: inFence ? 'code' : 'text',
    });
  });
}

fs.writeFileSync(
  path.join(assetsDir, 'search-index.js'),
  `window.__CRTC_USER_GUIDE_SEARCH__=${JSON.stringify(searchEntries)};\n`,
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
