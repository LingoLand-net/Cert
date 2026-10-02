/* Lingo‑Ville — Certificate app i18n
 * Simple EN/FR dictionary with data-i18n attribute scanning + localStorage persistence.
 * Exposes window.i18n = { t, apply, setLang, toggle, get lang }
 *
 * t(key) returns:
 *   - the string at that path (with {var} interpolation if vars passed)
 *   - the raw value (array / object) if the path resolves to one
 *   - the key itself as a last-resort fallback
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'lv-cert-lang';

  var dict = {
    en: {
      meta: {
        title: 'Lingo‑Ville | Official Certificate & Credential Verification',
      },
      brand: {
        sub: 'Certificate<br>Verification',
      },
      nav: {
        home: 'Home',
        verify: 'Verify',
        support: 'Support',
        mainSite: 'Main site',
        login: 'Login',
        toggleEn: 'English · FR',
        toggleFr: 'French · EN',
        toggleAria: 'Switch language',
        socialsAria: 'Follow Lingo‑Ville on social media',
        mobileSite: 'Site',
        current: 'Current page',
        menuAria: 'Toggle navigation',
      },
      hero: {
        eyebrow: 'Certificate / Verify',
        titleA: 'Verify a ',
        titleEm: 'certificate',
        titleB: '.',
        copy: 'Enter the certificate ID printed on the document. You can also scan the QR code on the certificate — it points directly here.',
      },
      search: {
        label: 'Certificate ID',
        placeholder: 'e.g. encom-26abk-b1',
        verify: 'Verify',
        or: 'or',
        scanBtn: 'Scan QR Code',
        scanHint: 'Uses your device camera · No image is stored',
      },

      samples: {
        eyebrow: '02 / What you are verifying',
        title: 'Real certificates, made to be checked.',
        intro: 'Every Lingo Ville certificate carries a unique ID, an issue date, and a QR code. Tap a preview to try one.',
        cards: [
          { tag: 'CEFR · A1' },
          { tag: 'CEFR · B2' },
          { tag: 'CEFR · C1' },
        ],
      },

      steps: {
        eyebrow: '03 / How it works',
        title: 'Three steps from paper to proof.',
        items: [
          { title: 'Find the ID', body: 'Look on the bottom of the certificate — every one carries a unique code.' },
          { title: 'Enter or scan', body: 'Type the ID above, or scan the QR code printed on the document.' },
          { title: 'See the record', body: 'We show the verified details and the original signed PDF.' },
        ],
      },

      loading: {
        title: 'Looking up certificate…',
        sub: 'Fetching record · Rendering PDF',
      },
      result: {
        officialCert: 'Official Certificate',
        rendering: 'Rendering PDF…',
        reportTitle: 'Student Performance Report',
        reportCopy: 'Detailed academic report accompanying this certificate.',
        reportBtn: 'Download Report',
        authenticTag: 'Authentic document',
        authenticCopy: 'This digital verification confirms the integrity of the Lingo‑Ville certificate.',
        detailsTitle: 'Certificate Details',
        fields: {
          id: 'Certificate ID',
          student: 'Student',
          course: 'Course',
          level: 'Level',
          date: 'Issue date',
          issuer: 'Issued by',
        },
        shareTitle: 'Share',
        story: 'Story',
        linkedin: 'LinkedIn',
        copy: 'Copy',
        back: '← Verify another certificate',
      },
      status: {
        verified: 'Verified · Active Certificate',
        revoked: 'This certificate has been revoked',
        pending: 'This certificate is pending review',
        prefix: 'Status: ',
      },
      error: {
        title: 'Certificate not found',
        body: 'The ID you entered does not match any record.',
        networkTitle: 'Verification Error',
        networkBody: 'Could not reach the verification service. Please try again.',
        notFoundBody: 'No certificate matches the ID “{id}”.',
        tryAgain: 'Try another certificate',
        revokedNote: 'The PDF preview has been disabled because this certificate is revoked.',
        revokedNoteSub: 'If you believe this is an error, contact {email}.',
        pdfUnavailable: 'Certificate file is not available.',
        openCert: 'Open Certificate',
        openNewTab: 'Opens in a new tab',
        opensViewer: 'Opens in your device PDF viewer',
        tapToOpen: 'Tap to open',
      },
      footer: {
        tagline: 'Accredited language centre — official certificate issuer. Verify authentic credentials issued by Lingo‑Ville Language Centre.',
        content: 'Content',
        support: 'Support',
        authenticity: 'Certificate authenticity',
        reports: 'Student reports',
        validation: 'Credential validation',
        books: 'LingoLand Course Books',
        mainSite: 'lingo-ville.com',
        location: 'Sfax, Tunisia',
        rights: '© {year} Lingo‑Ville. All rights reserved.',
        verifiable: 'Verifiable digital credentials',
      },
      qr: {
        modalTitle: 'Scan Certificate QR',
        closeAria: 'Close scanner',
        scanAria: 'Scan QR code with camera',
        requesting: 'Requesting camera access…',
        denied: 'Camera permission denied. Please allow camera access and try again.',
        noCamera: 'No camera found on this device.',
        inUse: 'Camera is in use by another app. Close it and retry.',
        generic: 'Could not access the camera.',
        retry: 'Try Again',
        hint: 'Align the QR code inside the frame.',
        hintBold: 'Scanning happens on your device.',
        detected: '✓ QR detected',
      },
      toasts: {
        httpsRequired: 'Camera requires HTTPS',
        cameraUnsupported: 'Camera not supported in this browser',
        libFailed: 'QR library failed to load. Please refresh.',
        qrUnreadable: 'Could not read the QR code. Try again.',
        storyMobile: 'Open this page on your phone to post to Instagram Story',
        linkCopied: 'Verification link copied',
        promptCopy: 'Copy this link:',
      },
      support: {
        titleMeta: 'Lingo‑Ville | Support',
        eyebrow: 'Support / Contact',
        titleA: 'We are ',
        titleEm: 'here',
        titleB: ' to help.',
        copy: 'Questions about a certificate, a course, or the verification process? Pick the channel that works best for you.',
        channelsTitle: 'Reach us',
        emailTitle: 'Email',
        emailCopy: 'Best for detailed questions. We reply within one business day.',
        phoneTitle: 'Phone',
        phoneCopy: 'For direct, immediate questions during office hours.',
        whatsappTitle: 'WhatsApp',
        whatsappCopy: 'Quick messages, no forms. Send us a note and we will reply.',
        addressTitle: 'Visit us',
        addressCopy: 'Come by the centre in Sfax. Coffee is on us.',
        instagramTitle: 'Instagram',
        instagramCopy: 'Follow for updates, events, and student stories.',
        linkedinTitle: 'LinkedIn',
        linkedinCopy: 'For institutional and employer verification requests.',
        hoursTitle: 'Office hours',
        hoursMonFri: 'Monday – Friday',
        hoursSat: 'Saturday',
        hoursSun: 'Sunday',
        hoursMonFriTime: '09:00 – 20:00',
        hoursSatTime: '09:00 – 14:00',
        hoursSunTime: 'Closed',
        verifyTitle: 'Certificate verification',
        verifyCopy: 'Employers and institutions can verify a Lingo‑Ville certificate directly on the verification page — no account needed.',
        verifyCta: 'Open verification',
      },
    },

    fr: {
      meta: {
        title: 'Lingo‑Ville | Vérification officielle des certificats',
      },
      brand: {
        sub: 'Vérification<br>des certificats',
      },
      nav: {
        home: 'Accueil',
        verify: 'Vérifier',
        support: 'Support',
        mainSite: 'Site principal',
        login: 'Connexion',
        toggleEn: 'English · FR',
        toggleFr: 'Français · EN',
        toggleAria: 'Changer de langue',
        socialsAria: 'Suivez Lingo‑Ville sur les réseaux',
        mobileSite: 'Site',
        current: 'Page actuelle',
        menuAria: 'Ouvrir la navigation',
      },
      hero: {
        eyebrow: 'Certificat / Vérifier',
        titleA: 'Vérifiez un ',
        titleEm: 'certificat',
        titleB: '.',
        copy: 'Saisissez l’identifiant imprimé sur le document. Vous pouvez aussi scanner le QR code du certificat — il mène directement ici.',
      },
      search: {
        label: 'Identifiant du certificat',
        placeholder: 'ex. encom-26abk-b1',
        verify: 'Vérifier',
        or: 'ou',
        scanBtn: 'Scanner le QR code',
        scanHint: 'Utilise la caméra de votre appareil · Aucune image conservée',
      },

      samples: {
        eyebrow: '02 / Ce que vous vérifiez',
        title: 'De vrais certificats, faits pour être vérifiés.',
        intro: 'Chaque certificat Lingo Ville porte un identifiant unique, une date de délivrance et un QR code. Touchez un aperçu pour l’essayer.',
        cards: [
          { tag: 'CECRL · A1' },
          { tag: 'CECRL · B2' },
          { tag: 'CECRL · C1' },
        ],
      },

      steps: {
        eyebrow: '03 / Comment ça marche',
        title: 'Trois étapes, du papier à la preuve.',
        items: [
          { title: 'Trouvez l’identifiant', body: 'Regardez en bas du certificat — chacun porte un code unique.' },
          { title: 'Saisissez ou scannez', body: 'Tapez l’identifiant ci-dessus, ou scannez le QR code imprimé sur le document.' },
          { title: 'Consultez le dossier', body: 'Nous affichons les détails vérifiés et le PDF signé original.' },
        ],
      },

      loading: {
        title: 'Recherche du certificat…',
        sub: 'Récupération · Rendu du PDF',
      },
      result: {
        officialCert: 'Certificat officiel',
        rendering: 'Rendu du PDF…',
        reportTitle: 'Rapport de performance',
        reportCopy: 'Rapport académique détaillé accompagnant ce certificat.',
        reportBtn: 'Télécharger le rapport',
        authenticTag: 'Document authentique',
        authenticCopy: 'Cette vérification numérique confirme l’intégrité du certificat Lingo‑Ville.',
        detailsTitle: 'Détails du certificat',
        fields: {
          id: 'Identifiant',
          student: 'Étudiant',
          course: 'Cours',
          level: 'Niveau',
          date: 'Date de délivrance',
          issuer: 'Délivré par',
        },
        shareTitle: 'Partager',
        story: 'Story',
        linkedin: 'LinkedIn',
        copy: 'Copier',
        back: '← Vérifier un autre certificat',
      },
      status: {
        verified: 'Vérifié · Certificat actif',
        revoked: 'Ce certificat a été révoqué',
        pending: 'Ce certificat est en attente de validation',
        prefix: 'Statut : ',
      },
      error: {
        title: 'Certificat introuvable',
        body: 'L’identifiant saisi ne correspond à aucun enregistrement.',
        networkTitle: 'Erreur de vérification',
        networkBody: 'Impossible de joindre le service de vérification. Veuillez réessayer.',
        notFoundBody: 'Aucun certificat ne correspond à l’identifiant « {id} ».',
        tryAgain: 'Vérifier un autre certificat',
        revokedNote: 'L’aperçu PDF a été désactivé car ce certificat est révoqué.',
        revokedNoteSub: 'Si vous pensez qu’il s’agit d’une erreur, contactez {email}.',
        pdfUnavailable: 'Le fichier du certificat n’est pas disponible.',
        openCert: 'Ouvrir le certificat',
        openNewTab: 'S’ouvre dans un nouvel onglet',
        opensViewer: 'S’ouvre dans le lecteur PDF de votre appareil',
        tapToOpen: 'Touchez pour ouvrir',
      },
      footer: {
        tagline: 'Centre de langues agréé — émetteur officiel de certificats. Vérifiez les titres authentiques délivrés par Lingo‑Ville Language Centre.',
        content: 'Contenu',
        support: 'Support',
        authenticity: 'Authenticité des certificats',
        reports: 'Rapports étudiants',
        validation: 'Validation des titres',
        books: 'Manuels LingoLand',
        mainSite: 'lingo-ville.com',
        location: 'Sfax, Tunisie',
        rights: '© {year} Lingo‑Ville. Tous droits réservés.',
        verifiable: 'Titres numériques vérifiables',
      },
      qr: {
        modalTitle: 'Scanner le QR du certificat',
        closeAria: 'Fermer le scanner',
        scanAria: 'Scanner le QR code avec la caméra',
        requesting: 'Demande d’accès à la caméra…',
        denied: 'Accès à la caméra refusé. Autorisez l’accès et réessayez.',
        noCamera: 'Aucune caméra détectée sur cet appareil.',
        inUse: 'La caméra est utilisée par une autre application. Fermez-la et réessayez.',
        generic: 'Impossible d’accéder à la caméra.',
        retry: 'Réessayer',
        hint: 'Alignez le QR code dans le cadre.',
        hintBold: 'Le scan se fait sur votre appareil.',
        detected: '✓ QR détecté',
      },
      toasts: {
        httpsRequired: 'La caméra nécessite HTTPS',
        cameraUnsupported: 'Caméra non prise en charge par ce navigateur',
        libFailed: 'Échec du chargement du module QR. Rechargez la page.',
        qrUnreadable: 'Impossible de lire le QR code. Réessayez.',
        storyMobile: 'Ouvrez cette page sur votre téléphone pour publier en Story Instagram',
        linkCopied: 'Lien de vérification copié',
        promptCopy: 'Copiez ce lien :',
      },
      support: {
        titleMeta: 'Lingo‑Ville | Support',
        eyebrow: 'Support / Contact',
        titleA: 'Nous sommes ',
        titleEm: 'là',
        titleB: ' pour vous aider.',
        copy: 'Une question sur un certificat, un cours ou la procédure de vérification ? Choisissez le canal qui vous convient.',
        channelsTitle: 'Nous joindre',
        emailTitle: 'E-mail',
        emailCopy: 'Pour les questions détaillées. Réponse sous un jour ouvré.',
        phoneTitle: 'Téléphone',
        phoneCopy: 'Pour les questions immédiates pendant les heures d’ouverture.',
        whatsappTitle: 'WhatsApp',
        whatsappCopy: 'Messages rapides, sans formulaire. Écrivez-nous, on répond.',
        addressTitle: 'Nous rendre visite',
        addressCopy: 'Passez au centre à Sfax. Le café est pour nous.',
        instagramTitle: 'Instagram',
        instagramCopy: 'Actualités, événements et histoires d’étudiants.',
        linkedinTitle: 'LinkedIn',
        linkedinCopy: 'Pour les demandes de vérification institutionnelles et employeurs.',
        hoursTitle: 'Heures d’ouverture',
        hoursMonFri: 'Lundi – Vendredi',
        hoursSat: 'Samedi',
        hoursSun: 'Dimanche',
        hoursMonFriTime: '09h00 – 20h00',
        hoursSatTime: '09h00 – 14h00',
        hoursSunTime: 'Fermé',
        verifyTitle: 'Vérification de certificat',
        verifyCopy: 'Les employeurs et institutions peuvent vérifier un certificat Lingo‑Ville directement sur la page de vérification — sans compte.',
        verifyCta: 'Ouvrir la vérification',
      },
    },
  };

  // ---------- Helpers ----------
  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return (v === 'en' || v === 'fr') ? v : null;
    } catch (_) { return null; }
  }

  function detectInitial() {
    var stored = getStored();
    if (stored) return stored;
    var b = (navigator.language || 'en').toLowerCase();
    return b.indexOf('fr') === 0 ? 'fr' : 'en';
  }

  var current = detectInitial();

  // Traverse the dict by dot-path and return whatever lives there —
  // string, array, object, or undefined. Falls back to EN on miss.
  function resolve(path) {
    if (!path) return undefined;

    function walk(root) {
      var parts = path.split('.');
      var cur = root;
      for (var i = 0; i < parts.length; i++) {
        if (cur && typeof cur === 'object' && parts[i] in cur) {
          cur = cur[parts[i]];
        } else {
          return undefined;
        }
      }
      return cur;
    }

    var fromCurrent = walk(dict[current]);
    if (fromCurrent !== undefined) return fromCurrent;

    var fromEn = walk(dict.en);
    return fromEn;
  }

  function t(key, vars) {
    var v = resolve(key);
    if (v == null) return key;
    // Arrays / objects pass through untouched so callers can destructure them.
    if (typeof v !== 'string') return v;

    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(function (k) {
        v = v.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return v;
  }

  // ---------- Apply to DOM ----------
  function apply(root) {
    var scope = root || document;

    // Text content via data-i18n (only strings assigned here)
    var els = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      var val = t(key);
      if (typeof val === 'string') el.textContent = val;
    }

    // HTML content via data-i18n-html
    var htmlEls = scope.querySelectorAll('[data-i18n-html]');
    for (var h = 0; h < htmlEls.length; h++) {
      var hel = htmlEls[h];
      var hkey = hel.getAttribute('data-i18n-html');
      if (!hkey) continue;
      var hval = t(hkey);
      if (typeof hval === 'string') hel.innerHTML = hval;
    }

    // Attribute translation via data-i18n-attr="placeholder:key,aria-label:key2"
    var attrEls = scope.querySelectorAll('[data-i18n-attr]');
    for (var a = 0; a < attrEls.length; a++) {
      var ael = attrEls[a];
      var spec = ael.getAttribute('data-i18n-attr') || '';
      spec.split(',').forEach(function (pair) {
        var idx = pair.indexOf(':');
        if (idx === -1) return;
        var attr = pair.slice(0, idx).trim();
        var key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;
        var v = t(key);
        if (typeof v === 'string') ael.setAttribute(attr, v);
      });
    }

    // Title
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      var tv = t(titleEl.getAttribute('data-i18n'));
      if (typeof tv === 'string') document.title = tv;
    }

    // Language toggle label — updates every element with data-lang-toggle
    var toggleLabels = scope.querySelectorAll('[data-lang-toggle]');
    for (var ti = 0; ti < toggleLabels.length; ti++) {
      toggleLabels[ti].textContent = current === 'en' ? t('nav.toggleEn') : t('nav.toggleFr');
    }

    // html lang attribute
    document.documentElement.lang = current;
  }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'fr') return;
    if (lang === current) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
  }

  function toggle() {
    setLang(current === 'en' ? 'fr' : 'en');
  }

  // ---------- Expose ----------
  window.i18n = {
    t: t,
    resolve: resolve,       // useful when a caller wants the raw value (arrays etc.)
    apply: apply,
    setLang: setLang,
    toggle: toggle,
    get lang() { return current; }
  };

  // ---------- Auto-wire ----------
  function boot() {
    apply();
    document.querySelectorAll('[data-lang-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggle(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();