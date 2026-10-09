/* ==========================================================================
   Azure 个人主页 · 交互脚本（原生 JS，无依赖）
   功能：主题切换 / 吸顶导航状态 / 移动端菜单 / 锚点平滑滚动 /
         目录高亮与进度条 / 阅读进度圆环 / 字数与阅读时长 / 代码复制 /
         文章分类筛选 / 站点运行天数 / 页脚年份
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     站点配置：把这里改成你自己的数据
     ------------------------------------------------------------------------ */
  var SITE = {
    startDate: '2024-03-15', // 站点上线日期，用于计算「已运行天数」
    wordsPerMinute: 400 // 阅读速度（字/分钟），用于估算阅读时长
  };

  var THEME_KEY = 'theme';
  var THEME_ORDER = ['system', 'light', 'dark'];
  var THEME_LABEL = { system: '跟随系统', light: '亮色主题', dark: '暗色主题' };

  var html = document.documentElement;
  var root = document.getElementById('highlight-gradient');

  /* ------------------------------------------------------------------------
     localStorage 兜底（file:// 直接打开时可能被浏览器禁用）
     ------------------------------------------------------------------------ */
  var memoryStore = {};
  var store = {
    get: function (key) {
      try {
        return window.localStorage.getItem(key);
      } catch (err) {
        return key in memoryStore ? memoryStore[key] : null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (err) {
        memoryStore[key] = value;
      }
    }
  };

  /* ------------------------------------------------------------------------
     1. 主题：跟随系统 / 亮色 / 暗色 三态循环
     ------------------------------------------------------------------------ */
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  var metaThemeColor = document.querySelector('meta[name="theme-color"]');

  function currentTheme() {
    var saved = store.get(THEME_KEY);
    return THEME_ORDER.indexOf(saved) > -1 ? saved : 'system';
  }

  function applyTheme(name) {
    var resolved = name === 'system' ? (media.matches ? 'dark' : 'light') : name;
    html.classList.toggle('dark', resolved === 'dark');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolved === 'dark' ? '#0B0B10' : '#FCFCFD'
      );
    }
    var btn = document.getElementById('toggleDarkMode');
    if (btn) {
      btn.dataset.theme = name;
      btn.title = '主题：' + THEME_LABEL[name];
    }
  }

  applyTheme(currentTheme());

  var themeBtn = document.getElementById('toggleDarkMode');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next =
        THEME_ORDER[(THEME_ORDER.indexOf(currentTheme()) + 1) % THEME_ORDER.length];
      store.set(THEME_KEY, next);
      applyTheme(next);
    });
  }

  // 系统主题变化时，如果当前是「跟随系统」则同步
  var onSchemeChange = function () {
    if (currentTheme() === 'system') applyTheme('system');
  };
  if (media.addEventListener) media.addEventListener('change', onSchemeChange);
  else if (media.addListener) media.addListener(onSchemeChange);

  /* ------------------------------------------------------------------------
     2. 吸顶导航：离开顶部后加 .not-top，变成玻璃卡片
     ------------------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  var ticking = false;

  function syncHeaderState() {
    ticking = false;
    if (!header) return;
    var notTop = window.scrollY > 16;
    header.classList.toggle('not-top', notTop);
    // 展开的移动端菜单在滚动时收起
    if (notTop && header.classList.contains('expanded')) {
      header.classList.remove('expanded');
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      syncHeaderState();
      updateToc();
      updateReadingProgress();
    });
  }

  syncHeaderState();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ------------------------------------------------------------------------
     3. 移动端菜单
     ------------------------------------------------------------------------ */
  var menuBtn = document.getElementById('toggleMenu');
  if (menuBtn && header) {
    menuBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      header.classList.toggle('expanded');
    });

    document.addEventListener('click', function (event) {
      if (!header.classList.contains('expanded')) return;
      if (header.contains(event.target)) return;
      header.classList.remove('expanded');
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') header.classList.remove('expanded');
    });

    // 点击导航里的链接后收起
    header.querySelectorAll('.nav-panel a').forEach(function (link) {
      link.addEventListener('click', function () {
        header.classList.remove('expanded');
      });
    });
  }

  /* ------------------------------------------------------------------------
     4. 锚点平滑滚动
     ------------------------------------------------------------------------ */
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href^="#"]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href || href === '#') return;

    var target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!target) return;

    event.preventDefault();
    history.pushState(null, '', href);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ------------------------------------------------------------------------
     5. 目录（TOC）：当前章节高亮 + 进度条
     ------------------------------------------------------------------------ */
  var tocLinks = Array.prototype.slice.call(
    document.querySelectorAll('.toc a[href^="#"]')
  );

  var tocItems = tocLinks
    .map(function (link, index) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      var heading = document.getElementById(id);
      if (!heading) return null;
      return {
        index: index,
        heading: heading,
        li: link.closest('li'),
        bar: link.parentElement.querySelector('.toc-track > i'),
        progress: 0,
        inView: false
      };
    })
    .filter(Boolean);

  function updateToc() {
    if (!tocItems.length) return;

    var viewport = window.innerHeight;
    var scrollY = window.scrollY;

    tocItems.forEach(function (item, index) {
      var top = item.heading.getBoundingClientRect().top + scrollY;
      var next = tocItems[index + 1];
      var bottom = next
        ? next.heading.getBoundingClientRect().top + scrollY
        : Math.max(top + item.heading.offsetHeight, scrollY + viewport);

      var range = bottom - top || 1;
      var ratio = (viewport - (top - scrollY)) / range;

      item.inView = top - scrollY < viewport && bottom - scrollY > 0;
      item.progress = Math.max(0, Math.min(1, ratio));
    });

    tocItems.forEach(function (item) {
      if (item.bar) item.bar.style.height = (item.progress * 100).toFixed(1) + '%';
      if (item.li) {
        item.li.classList.toggle('is-active', item.inView);
        item.li.classList.toggle('is-read', !item.inView && item.progress >= 1);
      }
    });
  }

  updateToc();

  /* ------------------------------------------------------------------------
     6. 阅读进度圆环（文章页）
     ------------------------------------------------------------------------ */
  var ring = document.getElementById('reading-progress');
  var ringText = ring ? ring.querySelector('span') : null;
  var progressTarget = document.querySelector('[data-progress-target]');

  function updateReadingProgress() {
    if (!ring || !progressTarget) return;

    var rect = progressTarget.getBoundingClientRect();
    var scrollY = window.scrollY;
    var start = rect.top + scrollY;
    var end = start + progressTarget.offsetHeight;
    var consumed = scrollY + window.innerHeight * 0.75 - start;
    var ratio = Math.max(0, Math.min(1, consumed / ((end - start) || 1)));

    ring.style.setProperty('--progress', (ratio * 100).toFixed(1));
    if (ringText) ringText.textContent = Math.round(ratio * 100) + '%';
    ring.classList.toggle('is-visible', ratio > 0.01);
  }

  updateReadingProgress();

  /* ------------------------------------------------------------------------
     7. 字数与阅读时长
     ------------------------------------------------------------------------ */
  var wordCountEl = document.querySelector('[data-word-count]');
  var readTimeEl = document.querySelector('[data-read-time]');

  if (wordCountEl || readTimeEl) {
    var prose = document.querySelector('.prose');
    if (prose) {
      var text = prose.innerText || prose.textContent || '';
      var cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      var words = (
        text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []
      ).length;
      var total = cjk + words;
      var minutes = Math.max(1, Math.round(total / SITE.wordsPerMinute));

      if (wordCountEl) wordCountEl.textContent = total.toLocaleString('zh-CN');
      if (readTimeEl) readTimeEl.textContent = minutes;
    }
  }

  /* ------------------------------------------------------------------------
     8. 代码块复制按钮
     ------------------------------------------------------------------------ */
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    var wrapper = pre.closest('.code-block') || pre;
    if (!wrapper.classList.contains('code-block')) wrapper.classList.add('code-block');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制代码');

    btn.addEventListener('click', function () {
      var code = pre.querySelector('code');
      var value = code ? code.innerText : pre.innerText;

      var done = function () {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        window.setTimeout(function () {
          btn.textContent = '复制';
          btn.classList.remove('copied');
        }, 1600);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, function () {
          btn.textContent = '复制失败';
        });
      } else {
        var area = document.createElement('textarea');
        area.value = value;
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand('copy');
          done();
        } catch (err) {
          btn.textContent = '复制失败';
        }
        document.body.removeChild(area);
      }
    });

    wrapper.appendChild(btn);
  });

  /* ------------------------------------------------------------------------
     9. 文章列表页的分类筛选
     ------------------------------------------------------------------------ */
  var filterBtns = Array.prototype.slice.call(
    document.querySelectorAll('.filter-btn[data-filter]')
  );
  var postItems = Array.prototype.slice.call(
    document.querySelectorAll('.post-item[data-category]')
  );

  if (filterBtns.length && postItems.length) {
    var applyFilter = function (name) {
      var valid = filterBtns.some(function (btn) {
        return btn.dataset.filter === name;
      });
      var current = valid ? name : 'all';

      filterBtns.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.dataset.filter === current);
      });

      var visible = 0;
      postItems.forEach(function (item) {
        var categories = (item.dataset.category || '').split(/\s+/);
        var show = current === 'all' || categories.indexOf(current) > -1;
        item.hidden = !show;
        if (show) visible += 1;
      });

      var empty = document.querySelector('[data-empty-hint]');
      if (empty) empty.hidden = visible > 0;
    };

    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.filter;
        history.replaceState(null, '', name === 'all' ? '#' : '#all');
        applyFilter(name);
      });
    });

    applyFilter((window.location.hash || '#all').slice(1));
    window.addEventListener('hashchange', function () {
      applyFilter((window.location.hash || '#all').slice(1));
    });
  }

  /* ------------------------------------------------------------------------
     10. 站点运行天数 / 页脚年份
     ------------------------------------------------------------------------ */
  var daysEl = document.querySelector('[data-days-online]');
  if (daysEl) {
    var started = new Date(SITE.startDate + 'T00:00:00');
    var days = Math.max(
      0,
      Math.floor((Date.now() - started.getTime()) / 86400000)
    );
    daysEl.textContent = days.toLocaleString('zh-CN');
  }

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ------------------------------------------------------------------------
     11. 首屏渐变光随滚动淡出（参考主题的模糊封面淡出效果）
     ------------------------------------------------------------------------ */
  if (root) {
    var baseHighlight = function () {
      var value = parseFloat(
        window.getComputedStyle(html).getPropertyValue('--highlight-opacity')
      );
      return isNaN(value) ? 0.25 : value;
    };

    window.addEventListener(
      'scroll',
      function () {
        var base = baseHighlight();
        var ratio = Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.6));
        root.style.opacity = (ratio * base).toFixed(3);
      },
      { passive: true }
    );
  }

  /* ------------------------------------------------------------------------
     12. 画廊灯箱：点击缩略图查看大图
     ------------------------------------------------------------------------ */
  var lightbox = document.getElementById('lightbox');
  if (lightbox) {
    var lbImg = lightbox.querySelector('img');
    var lbCap = lightbox.querySelector('.lightbox-cap');
    var lbClose = lightbox.querySelector('.lightbox-close');
    var lastTrigger = null;

    var closeLightbox = function () {
      lightbox.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    };

    var openLightbox = function (item) {
      var full = item.getAttribute('data-full');
      if (!full || !lbImg) return;

      lbImg.src = full;
      lbImg.alt = item.getAttribute('data-caption') || '';
      if (lbCap) lbCap.textContent = item.getAttribute('data-caption') || '';

      lightbox.classList.add('is-open');
      document.body.classList.add('is-locked');
      lastTrigger = item;
      if (lbClose) lbClose.focus();
    };

    // 事件委托：静态与动态生成的画廊项都能打开灯箱
    document.addEventListener('click', function (event) {
      var item = event.target.closest
        ? event.target.closest('.gallery-item[data-full]')
        : null;
      if (item) {
        event.preventDefault();
        openLightbox(item);
      }
    });

    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox || event.target === lbClose) closeLightbox();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
        closeLightbox();
      }
    });
  }

  /* ------------------------------------------------------------------------
     13. 数据驱动画廊：按 gallery-data.js 渲染分组网格
     ------------------------------------------------------------------------ */
  var galleryHosts = Array.prototype.slice.call(
    document.querySelectorAll('[data-gallery]')
  );

  if (galleryHosts.length && window.GALLERY_DATA) {
    var groups = [];
    window.GALLERY_DATA.forEach(function (item) {
      var last = groups[groups.length - 1];
      if (!last || last.name !== item.group) {
        last = { name: item.group, items: [] };
        groups.push(last);
      }
      last.items.push(item);
    });

    galleryHosts.forEach(function (host) {
      groups.forEach(function (group) {
        var title = document.createElement('h3');
        title.className = 'gallery-group-title';
        title.textContent = group.name + ' · ' + group.items.length + ' 张';
        host.appendChild(title);

        var grid = document.createElement('div');
        grid.className = 'gallery-grid';

        group.items.forEach(function (item) {
          var link = document.createElement('a');
          link.className = 'gallery-item';
          link.href = 'assets/img/' + item.file;
          link.setAttribute('data-full', 'assets/img/' + item.file);
          link.setAttribute('data-caption', item.cap);

          var img = document.createElement('img');
          img.src = 'assets/img/' + item.file;
          img.alt = item.cap;
          img.loading = 'lazy';

          var badge = document.createElement('span');
          badge.className = 'gallery-cap';
          badge.textContent = group.name;

          link.appendChild(img);
          link.appendChild(badge);
          grid.appendChild(link);
        });

        host.appendChild(grid);
      });
    });
  }
})();
