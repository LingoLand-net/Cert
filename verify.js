/* Lingo‑Ville — public certificate verification */
(function () {
  const CFG = window.VERIFY_CONFIG;

  if (window.pdfjsLib && CFG.PDFJS_WORKER) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.PDFJS_WORKER;
  }

  const $ = (id) => document.getElementById(id);
  const sections = {
    search:  $('searchState'),
    loading: $('loadingState'),
    result:  $('resultState'),
    error:   $('errorState')
  };

  function showOnly(name) {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    sections[name].classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return String(d); }
  }

  function showToast(message, duration = 2400) {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(t._to);
    t._to = setTimeout(() => t.classList.remove('show'), duration);
  }

  const CERT_CACHE_TTL_MS = 5 * 60 * 1000;
  const CERT_CACHE_PREFIX = 'lv_cert_';
  function readCertCache(id) {
    try {
      const raw = localStorage.getItem(CERT_CACHE_PREFIX + id);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !p.data || !p.at || Date.now() - p.at > CERT_CACHE_TTL_MS) return null;
      return p.data;
    } catch (_) { return null; }
  }
  function writeCertCache(id, data) {
    try { localStorage.setItem(CERT_CACHE_PREFIX + id, JSON.stringify({ data, at: Date.now() })); } catch (_) {}
  }

  function parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return raw ? decodeURIComponent(raw).toLowerCase() : '';
  }
  function setHash(id) {
    const next = `#/${encodeURIComponent(id)}`;
    if (window.location.hash !== next) {
      window.history.pushState(null, '', next);
      handleRoute();
    }
  }
  function clearHash() {
    if (window.location.hash) window.history.pushState(null, '', window.location.pathname);
  }

  async function fetchCert(id) {
    const url = `${CFG.APPS_SCRIPT_URL}?action=getCert&id=${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('NETWORK_' + res.status);
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message || 'LOOKUP_FAILED');
    return json.data;
  }

  async function renderPdf(container, url) {
    container.innerHTML = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const scale = isMobile ? 1.25 : 1.5;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('FETCH_' + res.status);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages = isMobile ? 1 : pdf.numPages;
      for (let i = 1; i <= pages; i++) {
        const page = await pdf.getPage(i);
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        c.width = vp.width; c.height = vp.height;
        container.appendChild(c);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
      if (isMobile) {
        const c = container.querySelector('canvas');
        if (c) {
          const a = document.createElement('a');
          a.href = url; a.target = '_blank'; a.rel = 'noopener';
          a.className = 'block relative cursor-pointer';
          container.removeChild(c);
          a.appendChild(c);
          const pill = document.createElement('div');
          pill.className = 'absolute top-3 right-3 bg-white/95 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg pointer-events-none';
          pill.textContent = 'Tap to open';
          a.appendChild(pill);
          container.appendChild(a);
        }
      }
      return;
    } catch (err) { console.warn('PDF.js failed:', err); }
    container.innerHTML = `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener"
         class="block w-full py-10 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-teal-400 transition text-center">
        <p class="text-sm font-bold text-slate-700">Open Certificate</p>
        <p class="text-xs text-slate-400 mt-1">Opens in a new tab</p>
      </a>`;
  }

  function renderStatusBanner(status) {
    const el = $('statusBanner');
    if (status === 'active') {
      el.innerHTML = `<div class="flex items-center gap-3 px-5 py-3 bg-teal-50 border border-teal-200 rounded-2xl">
        <span class="text-sm font-bold text-teal-800">Verified · Active Certificate</span></div>`;
    } else if (status === 'revoked') {
      el.innerHTML = `<div class="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl">
        <span class="text-sm font-bold text-red-700">This certificate has been revoked</span></div>`;
    } else if (status === 'pending') {
      el.innerHTML = `<div class="flex items-center gap-3 px-5 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
        <span class="text-sm font-bold text-yellow-700">This certificate is pending review</span></div>`;
    } else {
      el.innerHTML = `<div class="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
        <span class="text-sm font-bold text-slate-700">Status: ${escapeHtml(status)}</span></div>`;
    }
  }

  async function renderResult(cert) {
    showOnly('result');
    renderStatusBanner(cert.Status);
    $('certIdBadge').textContent = cert.CertID;
    $('metaId').textContent = cert.CertID;
    $('metaName').textContent = cert.StudentName || '—';
    $('metaCourse').textContent = cert.Course || '—';
    $('metaLevel').textContent = cert.Level || '—';
    $('metaDate').textContent = fmtDate(cert.IssueDate);
    $('metaIssuer').textContent = cert.Issuer || 'Lingo-Ville Language Centre';

    const rc = $('reportCard');
    if (cert.ReportURL) { rc.classList.remove('hidden'); $('reportDownloadBtn').href = cert.ReportURL; }
    else rc.classList.add('hidden');

    const pv = $('pdfViewer');
    if (cert.Status === 'revoked') {
      pv.innerHTML = `<div class="text-center py-16 px-4">
        <p class="text-slate-500 font-semibold">PDF preview disabled — this certificate is revoked.</p></div>`;
    } else if (cert.CertURL) {
      pv.innerHTML = `<div class="text-center py-20"><div class="spinner mx-auto"></div>
        <p class="text-xs text-slate-400 mt-3">Rendering PDF…</p></div>`;
      renderPdf(pv, cert.CertURL);
    } else {
      pv.innerHTML = `<div class="text-center py-16 text-slate-500 text-sm">Certificate file unavailable.</div>`;
    }
  }

  function renderError(message, title) {
    showOnly('error');
    $('errorTitle').textContent = title || 'Certificate Not Found';
    $('errorMessage').textContent = message || 'The ID you entered does not match any record.';
  }

  let currentLookup = 0;
  async function handleRoute() {
    const id = parseHash();
    if (!id) { showOnly('search'); return; }
    const my = ++currentLookup;
    const cached = readCertCache(id);
    if (cached) { if (my === currentLookup) renderResult(cached); return; }
    showOnly('loading');
    try {
      const cert = await fetchCert(id);
      if (my !== currentLookup) return;
      writeCertCache(id, cert);
      renderResult(cert);
    } catch (err) {
      if (my !== currentLookup) return;
      if (err.message === 'CERT_NOT_FOUND') renderError(`No certificate matches "${id}".`, 'Certificate Not Found');
      else if (err.message === 'MISSING_CERT_ID') showOnly('search');
      else renderError('Could not reach the verification service. Please try again.', 'Verification Error');
    }
  }

  let prefetchTimer = null;
  const prefetchedIds = new Set();
  function prefetchCert(id) {
    if (!id || prefetchedIds.has(id) || readCertCache(id)) return;
    prefetchedIds.add(id);
    fetchCert(id).then(d => writeCertCache(id, d)).catch(() => {});
  }

  function getShareUrl() { return window.location.href; }
  async function shareInstagramStory() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Lingo‑Ville Certificate', text: 'I just got certified by Lingo‑Ville 🎓', url: getShareUrl() }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    showToast('Open this page on your phone to post to Instagram Story');
  }
  function shareLinkedIn() {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(getShareUrl())}`, '_blank', 'noopener,width=620,height=620');
  }
  async function shareCopyLink() {
    try { await navigator.clipboard.writeText(getShareUrl()); showToast('Link copied'); }
    catch (_) { window.prompt('Copy this link:', getShareUrl()); }
  }
  function wireShareButtons() {
    $('shareInstagramBtn')?.addEventListener('click', shareInstagramStory);
    $('shareLinkedinBtn')?.addEventListener('click', shareLinkedIn);
    $('shareLinkBtn')?.addEventListener('click', shareCopyLink);
  }

  // ===================================================================
  // QR SCANNER — snap → freeze → scan → redirect
  // ===================================================================
  const qr = {
    modal: null, stage: null, video: null, canvas: null, ctx: null,
    guide: null, outline: null, pill: null,
    errorBlock: null, errorMessage: null, errIcon: null, retryBtn: null,
    snapBtn: null, statusLine: null, closeBtn: null,
    stream: null,
    active: false,
    frozen: false,
    starting: false,
    loopTimer: null,
    frameW: 0, frameH: 0
  };

  function initQrScanner() {
    qr.modal        = $('qrModal');
    qr.stage        = $('qrStage');
    qr.video        = $('qrVideo');
    qr.canvas       = $('qrCanvas');
    qr.guide        = $('qrGuide');
    qr.outline      = $('qrOutline');
    qr.pill         = $('qrPill');
    qr.errorBlock   = $('qrErrorBlock');
    qr.errorMessage = $('qrErrorMessage');
    qr.errIcon      = $('qrErrIcon');
    qr.retryBtn     = $('qrRetryBtn');
    qr.snapBtn      = $('qrSnapBtn');
    qr.statusLine   = $('qrStatusLine');
    qr.closeBtn     = $('qrCloseBtn');

    if (!qr.modal) return;

    qr.ctx = qr.canvas.getContext('2d', { willReadFrequently: true });

    $('scanQrBtn')?.addEventListener('click', openQrScanner);
    qr.closeBtn?.addEventListener('click', closeQrScanner);
    qr.retryBtn?.addEventListener('click', startCamera);
    qr.snapBtn?.addEventListener('click', () => snapAndScan(true));

    qr.modal.addEventListener('click', (e) => {
      if (e.target === qr.modal) closeQrScanner();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qr.active) closeQrScanner();
    });

    console.log('[QR] Initialized. jsQR loaded?', typeof window.jsQR === 'function');
  }

  function showQrError(msg, icon = '📷', showRetry = true) {
    qr.stage.style.display = 'none';
    qr.errorBlock.classList.add('visible');
    qr.errorMessage.textContent = msg;
    qr.errIcon.textContent = icon;
    qr.retryBtn.style.display = showRetry ? 'inline-block' : 'none';
    qr.statusLine.textContent = '';
  }

  function hideQrError() {
    qr.stage.style.display = '';
    qr.errorBlock.classList.remove('visible');
  }

  function resetVisuals() {
    qr.guide.classList.remove('hidden');
    qr.outline.classList.remove('show');
    qr.pill.classList.remove('show', 'error');
    qr.pill.textContent = '✓ QR detected';
    qr.statusLine.textContent = 'Point at the QR code — auto-scanning…';
    qr.snapBtn.disabled = false;
  }

  async function openQrScanner() {
    if (!qr.modal) return;

    if (!window.isSecureContext) {
      showToast('Camera needs HTTPS — open this site over https://');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera not supported in this browser.');
      return;
    }
    if (typeof window.jsQR !== 'function' && !('BarcodeDetector' in window)) {
      showToast('QR library still loading — try again in a moment.');
      return;
    }

    qr.active = true;
    qr.frozen = false;
    qr.modal.classList.add('open');
    qr.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qr-modal-open');
    hideQrError();
    resetVisuals();

    await startCamera();
  }

  function closeQrScanner() {
    if (!qr.active) return;
    qr.active = false;
    qr.frozen = false;
    stopLoop();
    stopStream();
    qr.modal.classList.remove('open');
    qr.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qr-modal-open');
    resetVisuals();
  }

  async function startCamera() {
    if (qr.starting) return;
    qr.starting = true;
    try {
      stopStream();
      hideQrError();
      resetVisuals();
      qr.frozen = false;

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (err) {
        console.warn('[QR] Primary constraints failed:', err && err.name);
        // Try again with any camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (err2) {
          console.error('[QR] Camera access failed:', err2);
          let msg = 'Could not access the camera.';
          if (err2 && (err2.name === 'NotAllowedError' || err2.name === 'SecurityError')) {
            msg = 'Camera permission denied. Allow camera access in your browser settings, then tap Try Again.';
          } else if (err2 && (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError')) {
            msg = 'No camera found on this device. Enter the certificate ID manually instead.';
            showQrError(msg, '📷', false);
            return;
          } else if (err2 && err2.name === 'NotReadableError') {
            msg = 'Camera is in use by another app. Close it and try again.';
          }
          showQrError(msg, '⚠️', true);
          return;
        }
      }

      qr.stream = stream;
      const track = stream.getVideoTracks()[0];
      console.log('[QR] Camera ready:', track?.getSettings?.());

      qr.video.srcObject = stream;
      qr.video.muted = true;
      qr.video.playsInline = true;
      qr.video.setAttribute('playsinline', 'true');
      qr.video.setAttribute('webkit-playsinline', 'true');

      try { await qr.video.play(); } catch (err) { console.warn('[QR] video.play():', err); }

      await waitForVideoReady();

      const vw = qr.video.videoWidth || 1280;
      const vh = qr.video.videoHeight || 720;

      // Match canvas aspect to the camera feed so nothing is cropped.
      const maxDim = 900;
      const scale = Math.min(1, maxDim / Math.max(vw, vh));
      qr.frameW = Math.round(vw * scale);
      qr.frameH = Math.round(vh * scale);

      qr.canvas.width  = qr.frameW;
      qr.canvas.height = qr.frameH;

      console.log(`[QR] Frame ${vw}x${vh} → canvas ${qr.frameW}x${qr.frameH}`);

      startLoop();
    } finally {
      qr.starting = false;
    }
  }

  function waitForVideoReady() {
    return new Promise((resolve) => {
      if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      qr.video.addEventListener('loadeddata', finish, { once: true });
      qr.video.addEventListener('playing', finish, { once: true });
      const poll = setInterval(() => {
        if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) {
          clearInterval(poll); finish();
        }
      }, 100);
      setTimeout(() => { clearInterval(poll); finish(); }, 3000);
    });
  }

  function stopStream() {
    if (qr.stream) {
      qr.stream.getTracks().forEach(t => t.stop());
      qr.stream = null;
    }
    if (qr.video) qr.video.srcObject = null;
  }

  function startLoop() {
    stopLoop();
    let ticks = 0;

    // Draw the camera frame to the visible canvas, then try to decode that exact frame.
    const tick = () => {
      if (!qr.active || qr.frozen) return;

      const v = qr.video;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        try {
          qr.ctx.drawImage(v, 0, 0, qr.frameW, qr.frameH);
        } catch (err) {
          console.warn('[QR] drawImage failed:', err);
        }

        ticks++;
        if (ticks % 8 === 0) {
          console.log(`[QR] Live tick #${ticks} · ${qr.frameW}x${qr.frameH}`);
        }

        // Attempt auto-detect on this freshly drawn frame
        const found = detectOnCanvas(qr.canvas);
        if (found) { handleDetection(found); return; }
      }

      qr.loopTimer = setTimeout(tick, 220);
    };

    tick();
  }

  function stopLoop() {
    if (qr.loopTimer) { clearTimeout(qr.loopTimer); qr.loopTimer = null; }
  }

  /**
   * Snap the current video frame to the canvas, freeze, and analyze.
   * If called from the button, it always runs.
   * If called automatically, it's invoked from the loop only after
   * the frame is already drawn.
   */
  function snapAndScan(manual) {
    if (!qr.active || qr.frozen) return;
    const v = qr.video;
    if (!v || v.readyState < 2 || !v.videoWidth) {
      if (manual) showToast('Camera not ready yet');
      return;
    }

    // Draw the current frame to the canvas (this is the freeze)
    try { qr.ctx.drawImage(v, 0, 0, qr.frameW, qr.frameH); }
    catch (err) { if (manual) showToast('Could not grab frame'); return; }

    const found = detectOnCanvas(qr.canvas);
    if (found) {
      handleDetection(found);
      return;
    }

    if (manual) {
      showToast('No QR code found in the frame — try again');
      // brief visual cue
      qr.pill.textContent = '✕ No QR found';
      qr.pill.classList.add('show', 'error');
      setTimeout(() => { qr.pill.classList.remove('show', 'error'); qr.pill.textContent = '✓ QR detected'; }, 1000);
    }
  }

  /**
   * Run detection on the canvas — tries native BarcodeDetector (async)
   * and jsQR (sync). Returns a normalized result or null.
   * This is synchronous-only for jsQR; native result is handled via promise.
   */
  function detectOnCanvas(canvas) {
    // Try jsQR first — synchronous
    if (typeof window.jsQR === 'function') {
      let imageData;
      try { imageData = qr.ctx.getImageData(0, 0, canvas.width, canvas.height); }
      catch (err) { return null; }

      let code = null;
      try {
        code = window.jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth'
        });
      } catch (err) { /* ignore */ }

      if (code && code.data) {
        return { data: code.data, location: code.location };
      }
    }

    // Fire-and-forget native detector (async). If it succeeds, it'll call handleDetection itself.
    if ('BarcodeDetector' in window) {
      try {
        if (!qr._nativeDetector) {
          qr._nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
        qr._nativeDetector.detect(canvas)
          .then(codes => {
            if (!qr.active || qr.frozen) return;
            if (codes && codes.length && codes[0].rawValue) {
              const loc = codes[0].cornerPoints
                ? { cornerPoints: codes[0].cornerPoints }
                : null;
              handleDetection({ data: codes[0].rawValue, location: loc });
            }
          })
          .catch(() => {});
      } catch (_) {}
    }

    return null;
  }

  /**
   * Called the moment a QR is decoded.
   * Freezes the visible canvas (already shows the captured frame),
   * draws an outline around the QR, shows the badge, then redirects.
   */
  function handleDetection(result) {
    if (qr.frozen) return;
    qr.frozen = true;
    stopLoop();
    try { qr.video.pause(); } catch (_) {}

    console.log('[QR] Detected raw:', result.data);

    // Draw the QR outline on the frozen canvas
    drawOutlineOnCanvas(result.location);

    // Hide the guide frame, show the outline element with a border style
    qr.guide.classList.add('hidden');

    const certId = extractCertId(result.data);

    if (!certId) {
      console.warn('[QR] Content is not a Lingo-Ville cert ID');
      qr.pill.textContent = '✕ Not a Lingo‑Ville QR';
      qr.pill.classList.add('show', 'error');
      if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch (_) {}

      // Resume after a beat
      setTimeout(() => {
        if (!qr.active) return;
        qr.frozen = false;
        qr.guide.classList.remove('hidden');
        qr.outline.classList.remove('show');
        qr.pill.classList.remove('show', 'error');
        qr.pill.textContent = '✓ QR detected';
        try { qr.video.play().catch(() => {}); } catch (_) {}
        startLoop();
      }, 1400);
      return;
    }

    console.log('[QR] ✅ Cert ID:', certId);

    qr.pill.textContent = '✓ QR detected — opening…';
    qr.pill.classList.remove('error');
    qr.pill.classList.add('show');
    qr.statusLine.textContent = 'QR decoded — loading certificate…';

    if (navigator.vibrate) try { navigator.vibrate([40, 30, 80]); } catch (_) {}

    setTimeout(() => {
      closeQrScanner();
      const input = $('certInput');
      if (input) input.value = certId;
      setTimeout(() => setHash(certId), 60);
    }, 750);
  }

  function drawOutlineOnCanvas(location) {
    if (!location) return;

    let x, y, w, h;

    // jsQR location object
    if (location.topLeftCorner && location.bottomRightCorner) {
      const tl = location.topLeftCorner;
      const br = location.bottomRightCorner;
      x = Math.min(tl.x, br.x);
      y = Math.min(tl.y, br.y);
      w = Math.abs(br.x - tl.x);
      h = Math.abs(br.y - tl.y);
      // Expand a touch
      const pad = Math.max(8, Math.min(qr.frameW, qr.frameH) * 0.02);
      x -= pad; y -= pad; w += pad * 2; h += pad * 2;
    }
    // Native BarcodeDetector cornerPoints
    else if (location.cornerPoints && location.cornerPoints.length >= 4) {
      const xs = location.cornerPoints.map(p => p.x);
      const ys = location.cornerPoints.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      x = minX; y = minY; w = maxX - minX; h = maxY - minY;
      const pad = Math.max(8, Math.min(qr.frameW, qr.frameH) * 0.02);
      x -= pad; y -= pad; w += pad * 2; h += pad * 2;
    }
    // Fallback — centered square
    else {
      const size = Math.min(qr.frameW, qr.frameH) * 0.55;
      x = (qr.frameW - size) / 2;
      y = (qr.frameH - size) / 2;
      w = size; h = size;
    }

    // Clamp
    x = Math.max(0, x); y = Math.max(0, y);
    w = Math.min(qr.frameW - x, w); h = Math.min(qr.frameH - y, h);

    // Position the DOM overlay. The canvas uses width:100% with natural
    // aspect ratio, so we scale the pixel rect to a percentage.
    const pctX = (x / qr.frameW) * 100;
    const pctY = (y / qr.frameH) * 100;
    const pctW = (w / qr.frameW) * 100;
    const pctH = (h / qr.frameH) * 100;

    qr.outline.style.left = pctX + '%';
    qr.outline.style.top = pctY + '%';
    qr.outline.style.width = pctW + '%';
    qr.outline.style.height = pctH + '%';
    qr.outline.classList.add('show');
  }

  function extractCertId(content) {
    if (!content) return '';
    const s = String(content).trim();
    if (/^https?:\/\//i.test(s)) {
      try {
        const url = new URL(s);
        const hash = (url.hash || '').replace(/^#\/?/, '').trim();
        if (hash) {
          const d = decodeURIComponent(hash).toLowerCase();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(d)) return d;
        }
        for (const p of ['id', 'cert', 'certid', 'certificate']) {
          const v = url.searchParams.get(p);
          if (v && /^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(v.trim())) return v.trim().toLowerCase();
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length) {
          const last = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '').trim();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(last)) return last.toLowerCase();
        }
      } catch (_) {}
      return '';
    }
    const plain = s.toLowerCase();
    if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(plain)) return plain;
    return '';
  }

  // ---------- Events ----------
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('certInput').value.trim().toLowerCase();
    if (!val) return;
    setHash(val);
  });

  $('certInput').addEventListener('input', (e) => {
    clearTimeout(prefetchTimer);
    const val = e.target.value.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+){2,4}$/.test(val)) return;
    prefetchTimer = setTimeout(() => prefetchCert(val), 400);
  });

  $('backBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  $('errorBackBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // ---------- Boot ----------
  $('year').textContent = new Date().getFullYear();
  const initial = parseHash();
  if (initial) $('certInput').value = initial;

  wireShareButtons();
  initQrScanner();
  handleRoute();
})();