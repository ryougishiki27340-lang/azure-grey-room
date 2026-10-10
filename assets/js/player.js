/* ==========================================================================
   全局 BGM 播放器（跨页面持续播放）
   --------------------------------------------------------------------------
   设计说明：
   - 多页面站点，无法用一个进程跨页运行音频；这里采用「状态恢复」方案：
     切页/刷新时把当前曲目、进度、音量、播放状态写入 localStorage，
     新页面加载后立即重建 Audio 并 seek 到上次进度，做到近似无感继续。
   - 使用 Web Audio 的 GainNode 做淡出/淡入，曲目切换平滑过渡。
   - 浏览器自动播放限制：恢复播放失败时优雅降级为「已暂停」，等用户点击。
   - 依赖 assets/js/bgm-data.js（window.BGM_DATA 曲目清单）。
   ========================================================================== */
(function () {
  'use strict';

  var tracks = window.BGM_DATA || [];
  if (!tracks.length) return;

  /* ---------------- 存储键 ---------------- */
  var KEYS = {
    track: 'bgm:track',
    volume: 'bgm:volume',
    time: 'bgm:time',
    playing: 'bgm:playing'
  };

  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (err) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (err) { /* 忽略 */ }
    }
  };

  /* ---------------- 播放器核心 ---------------- */
  var audio = new Audio();
  audio.preload = 'auto';

  var audioCtx = null;
  var gainNode = null;

  // 惰性建立音频图：MediaElementSource 只能创建一次
  function ensureGraph() {
    if (audioCtx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    gainNode = audioCtx.createGain();
    var source = audioCtx.createMediaElementSource(audio);
    source.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = state.volume;
  }

  var state = {
    index: 0,
    volume: 0.7,
    time: 0,
    playing: false
  };

  // 开场曲目池：首次访问（无历史记录）时，从这里随机选一首尝试播放
  // 满足「每次进入网站响起《殻ノ少女》或《瑠璃の鳥》随机一首」；
  // 若浏览器已存有上次选择，则优先恢复上次曲目。
  var STARTER_TITLES = ['殻ノ少女', '瑠璃の鳥'];
  var starterPool = [];
  tracks.forEach(function (track, i) {
    var matched = STARTER_TITLES.some(function (name) {
      return track.title.indexOf(name) === 0;
    });
    if (matched) starterPool.push(i);
  });

  // 从 localStorage 恢复上次状态
  var savedIndex = parseInt(store.get(KEYS.track), 10);
  var hasSavedTrack = store.get(KEYS.track) !== null;
  if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < tracks.length) {
    state.index = savedIndex;
  } else if (starterPool.length) {
    state.index = starterPool[Math.floor(Math.random() * starterPool.length)];
  }
  var savedVolume = parseFloat(store.get(KEYS.volume));
  if (!isNaN(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
    state.volume = savedVolume;
  }
  var savedTime = parseFloat(store.get(KEYS.time));
  if (!isNaN(savedTime) && savedTime > 0) {
    state.time = savedTime;
  }
  var savedPlaying = store.get(KEYS.playing) === '1';

  var seeked = false;

  audio.addEventListener('loadedmetadata', function () {
    if (!seeked && state.time > 0 && isFinite(audio.duration)) {
      try { audio.currentTime = Math.min(state.time, audio.duration - 0.5); } catch (err) { }
      seeked = true;
    }
    notify();
  });

  audio.addEventListener('ended', function () {
    // 播完后自动切到下一首，形成连续播放列表
    playIndex((state.index + 1) % tracks.length);
  });

  audio.addEventListener('error', function () {
    state.playing = false;
    persist();
    notify();
  });

  // 每隔几秒与离开页面前保存进度
  window.setInterval(persist, 5000);
  window.addEventListener('pagehide', persist);

  function persist() {
    store.set(KEYS.track, String(state.index));
    store.set(KEYS.volume, String(state.volume));
    store.set(KEYS.time, String(audio.currentTime || state.time));
    store.set(KEYS.playing, state.playing ? '1' : '0');
  }

  /* ---------------- 淡入淡出 ---------------- */
  function fadeTo(value, seconds) {
    if (!audioCtx || !gainNode) return;
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setTargetAtTime(value, audioCtx.currentTime, seconds / 3);
  }

  /* ---------------- 控制方法 ---------------- */
  function loadTrack(index, shouldPlay) {
    if (index < 0 || index >= tracks.length) return;
    state.index = index;
    seeked = false;
    state.time = 0;
    audio.src = 'assets/audio/' + tracks[index].file;
    ensureGraph();
    if (gainNode) gainNode.gain.value = state.volume;
    if (shouldPlay) {
      play();
    } else {
      state.playing = false;
      persist();
      notify();
    }
  }

  function playIndex(index) {
    if (index === state.index && audio.src) {
      play();
      return;
    }
    // 淡出 -> 换曲 -> 淡入
    if (audioCtx && gainNode) {
      fadeTo(0, 0.35);
      window.setTimeout(function () {
        loadTrack(index, true);
      }, 380);
    } else {
      loadTrack(index, true);
    }
  }

  function play() {
    if (!audio.src) loadTrack(state.index, false);
    ensureGraph();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    var promise = audio.play();
    if (promise && promise.then) {
      promise.then(function () {
        state.playing = true;
        fadeTo(state.volume, 0.4);
        persist();
        notify();
      }, function () {
        // 浏览器自动播放限制：降级为暂停状态，等待用户点击
        state.playing = false;
        persist();
        notify();
      });
    }
  }

  function pause() {
    fadeTo(0, 0.3);
    window.setTimeout(function () {
      audio.pause();
      state.playing = false;
      if (gainNode) gainNode.gain.value = state.volume;
      persist();
      notify();
    }, 320);
  }

  function toggle() {
    if (state.playing) pause(); else play();
  }

  function next() {
    playIndex((state.index + 1) % tracks.length);
  }

  function prev() {
    playIndex((state.index - 1 + tracks.length) % tracks.length);
  }

  function setVolume(value) {
    state.volume = Math.max(0, Math.min(1, value));
    if (gainNode) gainNode.gain.value = state.volume;
    persist();
    notify();
  }

  /* ---------------- 对外 API ---------------- */
  function getState() {
    return {
      index: state.index,
      volume: state.volume,
      time: audio.currentTime || 0,
      duration: audio.duration || 0,
      playing: state.playing,
      tracks: tracks
    };
  }

  function notify() {
    if (typeof window.BGMPlayer.onUpdate === 'function') {
      window.BGMPlayer.onUpdate(getState());
    }
    updateBar(getState());
  }

  window.BGMPlayer = {
    tracks: tracks,
    _audio: audio,
    getState: getState,
    playIndex: playIndex,
    toggle: toggle,
    play: play,
    pause: pause,
    next: next,
    prev: prev,
    setVolume: setVolume,
    onUpdate: null
  };

  /* ---------------- 全站迷你控制条 ---------------- */
  var bar = document.createElement('div');
  bar.id = 'bgm-bar';
  bar.setAttribute('aria-label', 'BGM 播放器');
  bar.innerHTML =
    '<button type="button" class="bgm-btn bgm-prev" title="上一首">⏮</button>' +
    '<button type="button" class="bgm-btn bgm-play" title="播放 / 暂停">▶</button>' +
    '<button type="button" class="bgm-btn bgm-next" title="下一首">⏭</button>' +
    '<span class="bgm-title">—</span>' +
    '<input class="bgm-volume" type="range" min="0" max="1" step="0.05" value="0.7" title="音量" aria-label="音量" />' +
    '<a class="bgm-open" href="music.html" title="打开 BGM 栏目">♪</a>';
  document.body.appendChild(bar);

  bar.querySelector('.bgm-prev').addEventListener('click', prev);
  bar.querySelector('.bgm-next').addEventListener('click', next);
  bar.querySelector('.bgm-play').addEventListener('click', toggle);
  bar.querySelector('.bgm-open').addEventListener('click', function () {
    // 让链接正常跳转即可
  });
  var volumeInput = bar.querySelector('.bgm-volume');
  volumeInput.value = String(state.volume);
  volumeInput.addEventListener('input', function () {
    setVolume(parseFloat(volumeInput.value));
  });

  function updateBar(s) {
    var track = tracks[s.index];
    var title = bar.querySelector('.bgm-title');
    if (title) {
      title.textContent = track ? track.title : '—';
      title.title = track ? track.title : '';
    }
    var playBtn = bar.querySelector('.bgm-play');
    if (playBtn) {
      playBtn.textContent = s.playing ? '❚❚' : '▶';
      playBtn.title = s.playing ? '暂停' : '播放';
    }
    var vol = bar.querySelector('.bgm-volume');
    if (vol && document.activeElement !== vol) {
      vol.value = String(s.volume);
    }
    bar.classList.toggle('is-playing', s.playing);
  }

  /* ---------------- 初次加载：恢复上次状态 ---------------- */
  loadTrack(state.index, false);
  if (savedPlaying || !hasSavedTrack) {
    // 仅在用户此前确实播放过的情况下尝试恢复；
    // 首次访问也尝试播放开场曲目；若浏览器拦截自动播放，play() 内部会优雅降级。
    window.setTimeout(function () {
      play();
    }, 300);
  }
  notify();
})();
