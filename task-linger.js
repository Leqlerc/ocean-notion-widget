'use strict';

(() => {
  const LINGER_MS = 6000;
  let hideTimer = null;
  let autoOpenedDone = false;

  function setup() {
    const taskList = document.getElementById('taskList');
    const showDone = document.getElementById('showDone');
    if (!taskList || !showDone) return;

    // Let a completed task visibly land in the checked/struck-through state before
    // the normal Today filter hides completed work. This gives clear feedback
    // without permanently cluttering the active list.
    taskList.addEventListener('change', event => {
      const checkbox = event.target.closest('input[data-complete]');
      if (!checkbox || !checkbox.checked) return;

      if (!showDone.checked) {
        showDone.click();
        autoOpenedDone = true;
      } else if (!autoOpenedDone) {
        // The user already chose to show completed tasks, so leave that preference alone.
        return;
      }

      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (autoOpenedDone && showDone.checked) showDone.click();
        autoOpenedDone = false;
      }, LINGER_MS);
    }, true);

    // A manual interaction with Show done always overrides the temporary behavior.
    showDone.addEventListener('change', event => {
      if (!event.isTrusted) return;
      autoOpenedDone = false;
      clearTimeout(hideTimer);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, {once:true});
  } else {
    setup();
  }
})();
