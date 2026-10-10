/* ==========================================================================
   首页 BGM 板块组件
   在有 [data-bgm-panel] 容器的页面渲染「当前播放卡 + 精选曲目条」。
   依赖 assets/js/bgm-data.js 与 assets/js/player.js（先于本脚本加载）。
   ========================================================================== */
(function () {
  'use strict';

  window.addEventListener('load', function () {
    var host = document.querySelector('[data-bgm-panel]');
    if (!host || !window.BGMPlayer) return;

    var player = window.BGMPlayer;

    /* ---------- 精选曲目：默认池三首 + 顺序补足至 6 首 ---------- */
    var STARTER_TITLES = ['殻ノ少女', '瑠璃の鳥'];
    var picks = [];
    player.tracks.forEach(function (t, i) {
      var matched = STARTER_TITLES.some(function (name) {
        return t.title.indexOf(name) === 0;
      });
      if (matched) picks.push(i);
    });
    player.tracks.forEach(function (t, i) {
      if (picks.length >= 6) return;
      if (picks.indexOf(i) === -1) picks.push(i);
    });

    /* ---------- 当前播放卡 ---------- */
    var now = document.createElement('div');
    now.className = 'card bgm-now';
    now.innerHTML =
      '<button type="button" class="bgm-btn bgm-now-prev" title="上一首">⏮</button>' +
      '<button type="button" class="bgm-btn bgm-now-play" title="播放 / 暂停">▶</button>' +
      '<button type="button" class="bgm-btn bgm-now-next" title="下一首">⏭</button>' +
      '<span class="bgm-now-title">—</span>' +
      '<input class="bgm-now-volume bgm-volume" type="range" min="0" max="1" step="0.05" value="0.7" title="音量" aria-label="音量" />';
    host.appendChild(now);

    /* ---------- 精选曲目条 ---------- */
    var strip = document.createElement('div');
    strip.className = 'bgm-strip';
    picks.forEach(function (i) {
      var track = player.tracks[i];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bgm-chip';
      chip.dataset.index = String(i);
      chip.title = track.title;
      chip.textContent = track.title;
      chip.addEventListener('click', function () {
        player.playIndex(i);
      });
      strip.appendChild(chip);
    });
    host.appendChild(strip);

    /* ---------- 底部操作行 ---------- */
    var actions = document.createElement('div');
    actions.className = 'bgm-panel-actions';
    actions.innerHTML =
      '<span class="bgm-panel-hint">选一首作为全站背景音乐，切换页面也会继续播放。</span>' +
      '<a class="btn" href="music.html">查看全部 28 首<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg></a>';
    host.appendChild(actions);

    /* ---------- 状态同步 ---------- */
    var nowTitle = now.querySelector('.bgm-now-title');
    var nowPlay = now.querySelector('.bgm-now-play');
    var nowPrev = now.querySelector('.bgm-now-prev');
    var nowNext = now.querySelector('.bgm-now-next');
    var nowVolume = now.querySelector('.bgm-now-volume');

    nowPlay.addEventListener('click', function () { player.toggle(); });
    nowPrev.addEventListener('click', function () { player.prev(); });
    nowNext.addEventListener('click', function () { player.next(); });
    nowVolume.addEventListener('input', function () {
      player.setVolume(parseFloat(nowVolume.value));
    });

    function sync(s) {
      var track = s.tracks[s.index];
      if (nowTitle) nowTitle.textContent = track ? track.title : '—';
      if (nowPlay) {
        nowPlay.textContent = s.playing ? '❚❚' : '▶';
        nowPlay.title = s.playing ? '暂停' : '播放';
      }
      if (nowVolume && document.activeElement !== nowVolume) {
        nowVolume.value = String(s.volume);
      }
      strip.querySelectorAll('.bgm-chip').forEach(function (chip) {
        var i = parseInt(chip.dataset.index, 10);
        var current = i === s.index;
        chip.classList.toggle('is-current', current);
        chip.classList.toggle('is-playing', current && s.playing);
      });
    }

    sync(player.getState());
    window.setInterval(function () {
      sync(player.getState());
    }, 1000);
  });
})();
