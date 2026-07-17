(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const navButton = document.querySelector('.nav-toggle');
  const tocButton = document.querySelector('.toc-toggle');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const search = document.getElementById('global-search');
  const results = document.getElementById('search-results');
  const topButton = document.querySelector('.back-to-top');

  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function setTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem('crtc-user-guide-theme', theme); } catch (_) {}
  }

  themeButton?.addEventListener('click', () => {
    setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    if (document.querySelector('.mermaid[data-processed="true"]')) location.reload();
  });

  const desktopNav = matchMedia('(min-width: 861px)');

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
  });

  document.querySelectorAll('.copy-code').forEach((button) => {
    button.addEventListener('click', async () => {
      const code = button.closest('.code-block')?.querySelector('code')?.textContent || '';
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
        else {
          const area = document.createElement('textarea');
          area.value = code;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        button.textContent = '已复制';
        setTimeout(() => { button.textContent = '复制'; }, 1200);
      } catch (_) {
        button.textContent = '复制失败';
      }
    });
  });

  document.querySelectorAll('.expand-diagram').forEach((button) => {
    button.addEventListener('click', () => {
      const block = button.closest('.diagram-block');
      const expanded = !block.classList.contains('expanded');
      document.querySelectorAll('.diagram-block.expanded').forEach((item) => item.classList.remove('expanded'));
      block.classList.toggle('expanded', expanded);
      button.textContent = expanded ? '关闭放大' : '放大查看';
      button.setAttribute('aria-expanded', String(expanded));
      document.body.classList.toggle('diagram-open', expanded);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const block = document.querySelector('.diagram-block.expanded');
    if (!block) return;
    block.classList.remove('expanded');
    const button = block.querySelector('.expand-diagram');
    if (button) {
      button.textContent = '放大查看';
      button.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('diagram-open');
  });

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function renderSearch(query) {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    const terms = normalized.split(/\s+/).filter(Boolean);
    const entries = window.__CRTC_USER_GUIDE_SEARCH__ || [];
    const matches = [];
    for (const entry of entries) {
      const haystack = `${entry.p} ${entry.t}`.toLowerCase();
      if (!terms.every((term) => haystack.includes(term))) continue;
      matches.push(entry);
      if (matches.length >= 40) break;
    }
    results.innerHTML = matches.length
      ? matches.map((entry) => {
          const lower = entry.t.toLowerCase();
          const at = Math.max(0, lower.indexOf(terms[0]));
          const start = Math.max(0, at - 70);
          const snippet = `${start ? '…' : ''}${entry.t.slice(start, start + 180)}${entry.t.length > start + 180 ? '…' : ''}`;
          const href = `${entry.f}?q=${encodeURIComponent(query)}`;
          return `<a href="${href}"><strong>${escapeHtml(entry.p)}</strong><span>${escapeHtml(snippet)}</span><small>Markdown L${entry.l}</small></a>`;
        }).join('')
      : '<p>没有匹配结果</p>';
    results.hidden = false;
  }

  let searchTimer;
  search?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderSearch(search.value), 80);
  });
  search?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      search.value = '';
      renderSearch('');
      search.blur();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      search?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search-shell')) results.hidden = true;
  });

  function highlightQuery() {
    const query = new URLSearchParams(location.search).get('q')?.trim();
    if (!query) return;
    const article = document.querySelector('.doc-content');
    if (!article) return;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.toLowerCase().includes(query.toLowerCase())) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('script,style,mark')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const node = walker.nextNode();
    if (!node) return;
    const at = node.nodeValue.toLowerCase().indexOf(query.toLowerCase());
    const mark = document.createElement('mark');
    mark.className = 'search-hit';
    mark.textContent = node.nodeValue.slice(at, at + query.length);
    const after = node.splitText(at);
    after.nodeValue = after.nodeValue.slice(query.length);
    after.parentNode.insertBefore(mark, after);
    requestAnimationFrame(() => mark.scrollIntoView({ block: 'center' }));
  }

  addEventListener('scroll', () => {
    topButton?.classList.toggle('visible', scrollY > 600);
  }, { passive: true });
  topButton?.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: true,
      securityLevel: 'strict',
      theme: currentTheme() === 'dark' ? 'dark' : 'default',
      flowchart: { htmlLabels: true, useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true },
    });
  }
  highlightQuery();
})();
