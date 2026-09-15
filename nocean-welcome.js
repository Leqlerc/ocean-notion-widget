'use strict';
// Browser-local display only. No requests, provider calls, or stored task state.
(()=>{
  const messages=['Trust the process. Own the inputs.','Focus on the reps. Let the result follow.','Control the inputs; give the outcome time.','Consistency makes the invisible visible.','Do the work you can control.'];
  const clock=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'});
  const date=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'});
  function tick(){const now=new Date();document.getElementById('welcomeTime').textContent=clock.format(now);document.getElementById('welcomeDate').textContent=date.format(now);document.getElementById('welcomeLine').textContent=messages[now.getDate()%messages.length];}
  tick();setInterval(tick,1000);
})();
