const a=350,n=Object.freeze({on:!1,lastTap:-1/0});function r(t,e){return t.on?n:e-t.lastTap<350?{on:!0,lastTap:-1/0}:{on:!1,lastTap:e}}export{n as AUTO_OFF,a as DOUBLE_TAP_MS,r as accelerateTap};
