'use strict';
(() => {
  const dayBiomes = [
    ['kelp-day', 'Sunlit Kelp Forest'],
    ['lily-islands', 'Lily Islands'],
    ['mushroom-forest', 'Mushroom Forest'],
    ['twisty-bridge', 'Twisty Bridge']
  ];
  const nightBiomes = [
    ['blood-kelp', 'Blood Kelp Zone'],
    ['bulb-zone', 'Bulb Zone'],
    ['cove-tree', 'Cove Tree'],
    ['dunes', 'Dunes'],
    ['grand-reef', 'Grand Reef'],
    ['islands', 'Underwater Islands'],
    ['jelly-caves', 'Jelly Caves'],
    ['kelp-night', 'Moonlit Kelp Forest'],
    ['lily-caves', 'Lily Caves'],
    ['lost-river', 'Lost River'],
    ['mountains', 'Abyssal Mountains'],
    ['shallows-night', 'Moonlit Shallows'],
    ['sparse-reef', 'Sparse Reef'],
    ['twisty-bridge-night', 'Twisty Bridge · Night']
  ];
  let activeKey = '';
  let requestId = 0;

  function currentBiome(now = new Date()) {
    const hour = now.getHours();
    const isNight = hour < 6 || hour >= 20;
    const pool = isNight ? nightBiomes : dayBiomes;
    const hourSlot = Math.floor(now.getTime() / 3_600_000);
    const index = ((hourSlot % pool.length) + pool.length) % pool.length;
    const [key, label] = pool[index];
    return { key, label, mode: isNight ? 'night' : 'day' };
  }

  function updateBackground(force = false) {
    if (!document.body.classList.contains('decorated')) {
      activeKey = '';
      requestId += 1;
      delete document.body.dataset.biome;
      delete document.body.dataset.biomeName;
      delete document.body.dataset.biomeMode;
      document.documentElement.style.removeProperty('--decorated-bg-image');
      return;
    }

    const { key, label, mode } = currentBiome();
    if (!force && key === activeKey) return;
    activeKey = key;
    document.body.dataset.biome = key;
    document.body.dataset.biomeName = label;
    document.body.dataset.biomeMode = mode;

    const id = ++requestId;
    const url = `/assets/backgrounds/${key}.png`;
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
