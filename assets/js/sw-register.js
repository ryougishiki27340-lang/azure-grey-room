/* 注册 Service Worker：路径相对本脚本解析，兼容本地预览与 GitHub Pages 子目录 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  var swUrl = new URL('../../sw.js', document.currentScript.src).href;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register(swUrl).catch(function () {
      // 注册失败不影响站点使用（例如本地 file:// 打开）
    });
  });
})();
