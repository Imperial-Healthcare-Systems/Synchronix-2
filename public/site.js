
(function(){
  var routes = document.querySelectorAll('.page-view');
  var navItems = document.querySelectorAll('.nav-menu > li[data-nav]');
  function topNavOf(id){
    if(id.indexOf('service')===0 || id==='services') return 'services';
    return id;
  }
  function setActiveNav(id){
    var top = topNavOf(id);
    navItems.forEach(function(li){
      li.classList.toggle('active', li.getAttribute('data-nav')===top);
    });
  }
  function show(id){
    var target = document.getElementById('view-'+id);
    if(!target){ id='home'; target=document.getElementById('view-home'); }
    routes.forEach(function(v){ v.classList.remove('active'); });
    target.classList.add('active');
    setActiveNav(id);
    window.scrollTo({top:0,behavior:'instant' in window ? 'instant':'auto'});
    runReveal();
    runCounters(target);
    if(history.replaceState){ history.replaceState(null,'',location.pathname+'#'+id); }
    var menu=document.getElementById('navMenu'); if(menu) menu.classList.remove('open');
  }
  // delegate nav clicks
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-go]');
    if(!t) return;
    e.preventDefault();
    var go = t.getAttribute('data-go');
    if(go.indexOf('service:')===0){ show('service-'+go.split(':')[1]); }
    else { show(go); }
  });

  // sticky header shadow
  var header=document.getElementById('siteHeader');
  window.addEventListener('scroll', function(){
    if(header) header.classList.toggle('scrolled', window.scrollY>10);
  });

  // mobile nav toggle
  var toggle=document.getElementById('navToggle');
  if(toggle){ toggle.addEventListener('click', function(){ document.getElementById('navMenu').classList.toggle('open'); }); }

  // reveal on scroll
  var io;
  function revealVisibleNow(){
    // Reveal anything already within (or near) the viewport. Used as a robust
    // fallback so large sections and above-the-fold content never stay hidden.
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var els = document.querySelectorAll('.page-view.active .reveal:not(.in)');
    els.forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.top < vh * 0.92 && r.bottom > 0){ el.classList.add('in'); }
    });
  }
  function runReveal(){
    var els = document.querySelectorAll('.page-view.active .reveal:not(.in)');
    if(!('IntersectionObserver' in window)){ els.forEach(function(el){el.classList.add('in');}); return; }
    if(!io){
      // Trigger as soon as any part of the element enters the viewport (large
      // sections taller than the screen can never reach a high threshold).
      io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
      },{threshold:0, rootMargin:'0px 0px -8% 0px'});
    }
    els.forEach(function(el){ io.observe(el); });
    // Reveal whatever is on screen straight away (covers initial load).
    revealVisibleNow();
    // One more pass after layout/paint settles.
    requestAnimationFrame(revealVisibleNow);
    setTimeout(revealVisibleNow, 120);
  }
  // Safety net: re-check on scroll/resize in case the observer misses anything.
  window.addEventListener('scroll', revealVisibleNow, {passive:true});
  window.addEventListener('resize', revealVisibleNow, {passive:true});

  // animated counters
  function runCounters(scope){
    var nums = scope.querySelectorAll('[data-count]');
    nums.forEach(function(el){
      if(el.dataset.done) return;
      el.dataset.done='1';
      var target=parseInt(el.getAttribute('data-count'),10);
      var suffix=el.querySelector('.suffix');
      var sfx = suffix ? suffix.outerHTML : '';
      var start=0, dur=1400, t0=null;
      function step(ts){
        if(!t0)t0=ts;
        var p=Math.min((ts-t0)/dur,1);
        var val=Math.floor((0.5-Math.cos(p*Math.PI)/2)*target);
        el.innerHTML = val + sfx;
        if(p<1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  // tabs (contact page)
  document.addEventListener('click', function(e){
    var b=e.target.closest('[data-tab]'); if(!b) return;
    var wrap=b.closest('section');
    wrap.querySelectorAll('[data-tab]').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active');
    var name=b.getAttribute('data-tab');
    wrap.querySelectorAll('[data-panel]').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-panel')===name); });
  });

  // form handling (no backend -> success message)
  function isEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function handleForm(formId, msgId, required, successText, formType){
    var form=document.getElementById(formId); if(!form) return;
    var msg=document.getElementById(msgId);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var ok=true;
      form.querySelectorAll('.field').forEach(function(f){ f.classList.remove('error'); });
      required.forEach(function(n){
        var inp=form.querySelector('[name="'+n+'"]');
        if(!inp || inp.offsetParent===null) return; // skip missing or hidden (conditional) fields
        if(!inp.value.trim()){ ok=false; inp.closest('.field').classList.add('error'); }
      });
      var em=form.querySelector('[name="email"]');
      if(em && em.value.trim() && !isEmail(em.value.trim())){ ok=false; em.closest('.field').classList.add('error'); }
      msg.className='form-msg';
      if(!ok){ msg.classList.add('show','error'); msg.textContent='Please complete the required fields with valid details.'; return; }

      // collect all named fields (visible + hidden conditional fields are already cleared)
      var payload={ _form: formType };
      form.querySelectorAll('[name]').forEach(function(el){ payload[el.name]=el.value; });

      var btn=form.querySelector('[type="submit"]');
      var btnText=btn ? btn.innerHTML : '';
      if(btn){ btn.disabled=true; btn.style.opacity='.7'; btn.innerHTML='Sending…'; }
      msg.classList.add('show'); msg.textContent='Sending your details…';

      fetch('/api/contact', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(r){ return r.json().then(function(j){ return { status:r.status, body:j }; }).catch(function(){ return { status:r.status, body:{ ok:r.ok } }; }); })
      .then(function(res){
        if(res.body && res.body.ok){
          msg.className='form-msg show success'; msg.textContent=successText;
          form.reset(); // also re-syncs conditional fields via the reset handler
          msg.scrollIntoView({behavior:'smooth', block:'center'});
        } else {
          msg.className='form-msg show error';
          msg.textContent='Sorry — we could not send your message right now. Please email info@synchronixintegrated.com directly.';
        }
      })
      .catch(function(){
        msg.className='form-msg show error';
        msg.textContent='Network error. Please try again, or email info@synchronixintegrated.com directly.';
      })
      .then(function(){ if(btn){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=btnText; } });
    });
  }
  handleForm('enquiryForm','enqMsg',['name','email','phone'],"Thank you. Your enquiry has been recorded — our team will come back with a straight answer on how we can help.",'contact');
  handleForm('partnerForm','partMsg',['name','companyName','contact','email','vendorService','vendorOther','regionDetail'],"Thank you for your interest in partnering with Synchronix. Our team will review your details and be in touch.",'partner');

  // generic helper: reveal a "please specify" box when a select hits certain values
  function conditionalDetail(selectEl, wrapEl, showValues){
    if(!selectEl || !wrapEl) return null;
    var input=wrapEl.querySelector('input');
    var sync=function(focusOnShow){
      var show = showValues.indexOf(selectEl.value) !== -1;
      wrapEl.style.display = show ? '' : 'none';
      if(show){ if(focusOnShow && input) input.focus(); }
      else { if(input) input.value=''; wrapEl.classList.remove('error'); }
    };
    selectEl.addEventListener('change', function(){ sync(true); });
    sync(false); // initial state
    return sync;
  }

  // partner form conditional fields
  var partnerFormEl=document.getElementById('partnerForm');
  var syncVendorOther=conditionalDetail(
    document.querySelector('#partnerForm [name="vendorService"]'),
    document.getElementById('vendorOtherWrap'),
    ['Others - Please specify']
  );
  var syncRegionDetail=conditionalDetail(
    document.querySelector('#partnerForm [name="region"]'),
    document.getElementById('regionDetailWrap'),
    ['Region-specific', 'Multi-region']
  );
  if(partnerFormEl){
    partnerFormEl.addEventListener('reset', function(){
      setTimeout(function(){ if(syncVendorOther) syncVendorOther(false); if(syncRegionDetail) syncRegionDetail(false); }, 0);
    });
  }

  // cursor-tracked spotlight on cards
  if (window.matchMedia && window.matchMedia('(hover:hover)').matches) {
    document.addEventListener('pointermove', function(e){
      var c = e.target.closest ? e.target.closest('.feature-cell,.ind-cell') : null;
      if(!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, {passive:true});
  }

  // gradient scroll progress bar
  var prog=document.createElement('div'); prog.className='scroll-progress'; document.body.appendChild(prog);
  window.addEventListener('scroll', function(){
    var h=document.documentElement;
    var p=h.scrollTop/(h.scrollHeight-h.clientHeight||1);
    prog.style.transform='scaleX('+p+')';
  }, {passive:true});

  // 3D tilt on hero panel
  var panel=document.querySelector('.hero-panel');
  if(panel && window.matchMedia('(hover:hover)').matches){
    var wrap=panel.parentElement;
    wrap.addEventListener('pointermove', function(e){
      var r=panel.getBoundingClientRect();
      var x=(e.clientX-r.left)/r.width-0.5, y=(e.clientY-r.top)/r.height-0.5;
      panel.style.transform='perspective(900px) rotateY('+(x*6)+'deg) rotateX('+(-y*5)+'deg)';
    });
    wrap.addEventListener('pointerleave', function(){ panel.style.transform='perspective(900px) rotateY(0deg) rotateX(0deg)'; });
  }

  // live ops feed (illustrative)
  var opsMsgs=[
    'Shipment departed Nagpur hub → Hyderabad',
    'Inventory cycle count completed · Mumbai DC',
    'Last-mile route optimised · Delhi NCR · -12 min',
    'Reverse pickup confirmed · Bengaluru',
    'Line-haul arrived ahead of schedule · Kolkata',
    'WMS sync complete · 9 facilities online',
    'Freight consolidated · Chennai port leg'
  ];
  var opsEl=document.getElementById('opsMsg');
  if(opsEl){
    var oi=0;
    setInterval(function(){
      oi=(oi+1)%opsMsgs.length;
      opsEl.classList.add('swap');
      setTimeout(function(){ opsEl.textContent=opsMsgs[oi]; opsEl.classList.remove('swap'); }, 280);
    }, 3400);
  }

  // year
  var yr=document.getElementById('yr'); if(yr) yr.textContent=new Date().getFullYear();

  // initial route from hash
  var initial=(location.hash||'#home').slice(1);
  show(initial);
})();

