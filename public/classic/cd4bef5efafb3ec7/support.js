import{track as n}from"./analytics.js?v=ga-1";const d="milan@upi",k=`upi://pay?pa=${d}&pn=${encodeURIComponent("Milan Prajapati")}&cu=INR`,S="https://buymeacoffee.com/milanprajapati",b="https://discord.gg/FmFUQpFdCR",R="https://www.instagram.com/milanprajapati/",g="/classic-assets/414a4427a4dcdcc4/assets/img/support/upi-qr.webp",$="/classic-assets/414a4427a4dcdcc4/assets/img/support/instagram-qr.webp",v="/classic-assets/414a4427a4dcdcc4/assets/img/support/discord-icon.webp",w="/classic-assets/414a4427a4dcdcc4/assets/img/support/buy-me-a-coffee.svg",j='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>',_="Have ideas or suggestions? Join our Discord community, share your feedback, and help us make the game even better!",u='target="_blank" rel="noopener noreferrer"',C=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1,P=()=>"";async function x(r){try{return await navigator.clipboard.writeText(r),!0}catch{}const t=document.createElement("textarea");t.value=r,t.setAttribute("readonly",""),t.style.cssText="position:fixed;opacity:0;pointer-events:none",document.body.appendChild(t),t.select();let a=!1;try{a=document.execCommand("copy")}catch{}return t.remove(),a}function I(r,t){const a=r.closest(".front-menu"),e=a.querySelector(".menu-wrap"),s=document.createElement("div");s.className="support-backdrop",s.innerHTML=t,a.appendChild(s),e&&(e.inert=!0);const i=s.firstElementChild,l=[],c=()=>[...i.querySelectorAll("button, a[href]")].filter(o=>o.getClientRects().length),p=()=>{removeEventListener("keydown",h,!0);for(const o of l)o();s.remove(),e&&(e.inert=!1),r.focus({preventScroll:!0})},h=o=>{if(o.key==="Escape"){o.preventDefault(),o.stopImmediatePropagation(),p();return}if(o.key==="Tab"){const m=c(),f=m[0],y=m[m.length-1];i.contains(document.activeElement)?o.shiftKey&&document.activeElement===f?(o.preventDefault(),y.focus()):!o.shiftKey&&document.activeElement===y&&(o.preventDefault(),f.focus()):(o.preventDefault(),f.focus())}o.stopImmediatePropagation()};return addEventListener("keydown",h,!0),s.addEventListener("click",o=>{o.target===s&&p()}),i.querySelector(".support-close").onclick=p,i.querySelector(".support-close").focus({preventScroll:!0}),{modal:i,close:p,onClose:o=>l.push(o)}}function U(r){const{modal:t,close:a}=I(r,`<section class="support-modal support-join" role="dialog" aria-modal="true" aria-labelledby="join-title">
    <header class="support-head"><h2 id="join-title">Join Us</h2><button type="button" class="support-close" aria-label="Close">✕</button></header>
    <div class="join-tabs" role="tablist" aria-label="Communities">
      <button type="button" role="tab" class="join-tab" id="join-tab-discord" aria-controls="join-panel-discord" aria-selected="true" data-tab="discord">
        <img src="${v}" width="256" height="256" alt="" decoding="async">Discord</button>
      <button type="button" role="tab" class="join-tab" id="join-tab-instagram" aria-controls="join-panel-instagram" aria-selected="false" data-tab="instagram">
        ${j}Instagram</button>
    </div>
    <div class="join-panel join-discord" role="tabpanel" id="join-panel-discord" aria-labelledby="join-tab-discord">
      <h3>Join our Discord</h3>
      <div class="join-art"><img src="${v}" width="256" height="256" alt="Discord logo" decoding="async"></div>
      <div class="join-copy">
        <p>${_}</p>
        <a class="support-action support-main" href="${b}" ${u} data-discord="join_us">Join Discord</a>
      </div>
    </div>
    <div class="join-panel join-instagram" role="tabpanel" id="join-panel-instagram" aria-labelledby="join-tab-instagram" hidden>
      <h3>Follow us on Instagram</h3>
      <div class="join-art support-qr"><img src="${$}" width="576" height="576" alt="Instagram QR code for @milanprajapati" decoding="async"></div>
      <div class="join-copy">
        <p>Scan the code with your phone camera, or tap the button below. Catch new updates, race clips and behind-the-scenes from <strong>@milanprajapati</strong>.</p>
        <a class="support-action support-main" href="${R}" ${u} data-instagram>Open Instagram</a>
      </div>
    </div>
  </section>`),e=[...t.querySelectorAll("[role=tab]")];for(const s of e)s.onclick=()=>{for(const i of e){const l=i===s;i.setAttribute("aria-selected",String(l)),t.querySelector(`#${i.getAttribute("aria-controls")}`).hidden=!l}};t.querySelector("[data-discord]").addEventListener("click",()=>{n("discord_clicked",{from:"join_us"}),setTimeout(a,0)}),t.querySelector("[data-instagram]").addEventListener("click",()=>{n("instagram_clicked",{from:"join_us"}),setTimeout(a,0)})}function q(r){const{modal:t,onClose:a}=I(r,`<section class="support-modal support-coffee-modal" role="dialog" aria-modal="true" aria-labelledby="support-title" aria-describedby="support-intro">
    <header class="support-head"><h2 id="support-title">Support our efforts</h2><button type="button" class="support-close" aria-label="Close">✕</button></header>
    <div id="support-intro" class="support-intro">
      <p class="support-lead">Enjoying RoadRash Classic? 🏍️</p>
      <p>Your support helps cover server and hosting costs, improve the game, and bring exciting new features to life.</p>
      <p class="support-note">Completely optional: the game stays free, and you choose the amount.</p>
    </div>
    <div class="support-options">
      <section class="support-option support-pay-upi" aria-labelledby="support-upi-title">
        <h3 id="support-upi-title">UPI</h3>
        <div class="support-qr"><img src="${g}" width="1604" height="1578" alt="UPI QR code for ${d}"></div>
        <p class="support-hint">Scan with any UPI app and enter any amount you like.</p>
        <a class="support-save" href="${g}" download="milan-qr.webp" data-qr-save>Save QR code</a>
        <p class="support-or"><span>or use UPI ID</span></p>
        <div class="support-upi"><code>${d}</code><button type="button" class="support-action" data-copy>Copy</button></div>
        <p class="support-status" data-copy-status role="status" aria-live="polite"></p>
        <a class="support-action support-main" href="${k}" data-upi>UPI</a>
        <p class="support-status" data-upi-status role="status" aria-live="polite"></p>
      </section>
      <section class="support-option support-pay-card" aria-labelledby="support-card-title">
        <h3 id="support-card-title">Buy me a coffee</h3>
        <img class="support-coffee-art" src="${w}" width="35" height="50" alt="Buy Me a Coffee cup" decoding="async">
        <a class="support-action support-main" href="${S}" ${u} data-card><img class="support-coffee-icon" src="${w}" width="35" height="50" alt="">Buy me a coffee</a>
      </section>
    </div>
    <footer class="support-community"><p>${_}</p><a class="support-action" href="${b}" ${u} data-discord="popup">Join Discord</a></footer>
  </section>`),e=c=>t.querySelector(c);e("[data-qr-save]").onclick=()=>n("upi_qr_saved"),a(()=>{s?.disconnect(),clearTimeout(l)});let s=null;const i=e(".support-qr");typeof IntersectionObserver=="function"?(s=new IntersectionObserver(c=>{c.some(p=>p.isIntersecting)&&(n("upi_qr_viewed"),s.disconnect(),s=null)},{root:t,threshold:.6}),s.observe(i)):n("upi_qr_viewed"),e("[data-copy]").onclick=async()=>{n("upi_copy_clicked");const c=await x(d);e("[data-copy-status]").textContent=c?`Copied ${d}`:`Couldn't copy. Select ${d} and copy it yourself.`,c&&n("upi_id_copied")};let l=0;e("[data-upi]").onclick=c=>{const p=e("[data-upi-status]");if(n("upi_pay_clicked",{device:C()?"phone":"desktop"}),!C()){c.preventDefault(),p.textContent="UPI apps open on phones. Scan the QR code with your UPI app, or copy the UPI ID.";return}p.textContent="",clearTimeout(l),l=setTimeout(()=>{!document.hidden&&document.hasFocus()&&(p.textContent="No UPI app opened? Save or scan the QR code, or copy the UPI ID into your UPI app.")},1800)},e("[data-card]").onclick=()=>n("card_clicked"),e("[data-discord]").onclick=()=>n("discord_clicked",{from:"popup"})}function E(r){r.style.setProperty("--home-support","0px");}export{S as CARD_URL,b as DISCORD_URL,R as INSTAGRAM_URL,d as UPI_ID,k as UPI_LINK,E as mountSupport,U as openJoinUs,P as supportRow};
