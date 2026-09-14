'use strict';
(() => {
  const schedule = [
    [0, 8, 'tree-cove', 'Tree Cove'],
    [8, 10, 'safe-shallows', 'Safe Shallows'],
    [10, 12, 'kelp-forest', 'Kelp Forest'],
    [12, 14, 'grassy-plateaus', 'Grassy Plateaus'],
    [14, 16, 'jellyshroom', 'Jellyshroom Caves'],
    [16, 18, 'bulb-zone', 'Bulb Zone'],
    [18, 20, 'blood-kelp', 'Blood Kelp Zone'],
    [20, 22, 'grand-reef', 'Grand Reef'],
    [22, 24, 'lost-river', 'Lost River']
  ];
  let activeKey = '';
  let requestId = 0;

  function currentBiome(now = new Date()) {
    const hour = now.getHours();
    return schedule.find(([start, end]) => hour >= start && hour < end) || schedule[0];
  }

  function updateBackground(force = false) {
    if (!document.body.classList.contains('decorated')) {
      activeKey = '';
      requestId += 1;
      delete document.body.dataset.biome;
      delete document.body.dataset.biomeName;
      document.documentElement.style.removeProperty('--decorated-bg-image');
      return;
    }

    const [, , key, label] = currentBiome();
    if (!force && key === activeKey) return;
    activeKey = key;
    document.body.dataset.biome = key;
    document.body.dataset.biomeName = label;

    const id = ++requestId;
    const url = `/assets/backgrounds/${key}.webp`;
    const image = new Image();
    image.onload = () => {
      if (id !== requestId || key !== activeKey) return;
      document.documentElement.style.setProperty('--decorated-bg-image', `url("${url}")`);
    };
    image.onerror = () => {
      if (id !== requestId || key !== activeKey) return;
      document.documentElement.style.removeProperty('--decorated-bg-image');
    };
    image.src = url;
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateBackground(true);
    new MutationObserver(() => updateBackground(true)).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });
    window.setInterval(updateBackground, 60_000);
    window.addEventListener('focus', () => updateBackground());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) updateBackground();
    });
  }, { once: true });
})();
