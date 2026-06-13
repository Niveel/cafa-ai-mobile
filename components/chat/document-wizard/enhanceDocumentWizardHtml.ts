export function enhanceDocumentWizardHtml(
  html: string,
  accentColor: string,
  isDark: boolean,
) {
  const sanitizedHtml = html
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<p\b[^>]*>[\s\S]*?<\/p>(?=[\s\S]*<form\b)/i, '');

  const css = `
    :root {
      color-scheme: ${isDark ? 'dark' : 'light'};
      --wizard-accent: ${accentColor};
      --wizard-page: ${isDark ? '#0b1118' : '#f6f8fb'};
      --wizard-surface: ${isDark ? '#101821' : '#ffffff'};
      --wizard-surface-soft: ${isDark ? '#0f151d' : '#f8fafc'};
      --wizard-text: ${isDark ? '#ecf2f8' : '#12263f'};
      --wizard-muted: ${isDark ? '#9fb0c3' : '#62748a'};
      --wizard-border: ${isDark ? 'rgba(159,176,195,0.10)' : 'rgba(15,23,42,0.09)'};
      --wizard-danger: ${isDark ? '#ff8d8d' : '#bf3d3d'};
      --wizard-danger-bg: ${isDark ? '#2a1618' : '#fff6f6'};
      --wizard-input-bg: ${isDark ? '#121b24' : '#ffffff'};
      --wizard-input-border: ${isDark ? 'rgba(159,176,195,0.18)' : 'rgba(15,23,42,0.12)'};
      --wizard-shadow: ${isDark ? '0 8px 24px rgba(0,0,0,0.20)' : '0 6px 18px rgba(15,23,42,0.04)'};
      --wizard-radius: 14px;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: var(--wizard-page);
      color: var(--wizard-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 100%;
    }
    body {
      padding: 2px;
      font-size: 12px;
      line-height: 1.35;
    }
    form, main, .container, .wrapper, .content, .card, .form-card {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: transparent;
      padding: 2px !important;
    }
    h1, h2, h3 {
      margin: 0 0 3px;
      color: var(--wizard-text);
      line-height: 1.05;
      letter-spacing: -0.02em;
    }
    h1 { font-size: 0.92rem; }
    h2 { font-size: 0.82rem; }
    h3 { font-size: 0.78rem; }
    p, span, div, small, li {
      line-height: 1.2;
      color: var(--wizard-muted);
    }
    .wizard-validation-banner {
      display: none;
      border-radius: 10px;
      padding: 6px 7px;
      margin-bottom: 4px;
      border: 1px solid rgba(191,61,61,0.22);
      background: var(--wizard-danger-bg);
      color: var(--wizard-danger);
      font-weight: 700;
    }
    .wizard-validation-banner[data-visible="true"] { display: block; }
    fieldset, .wizard-panel {
      border: 1px solid var(--wizard-border);
      border-radius: var(--wizard-radius);
      padding: 4px;
      margin: 0 0 4px;
      background: var(--wizard-surface);
      box-shadow: var(--wizard-shadow);
    }
    label, legend {
      display: block;
      margin-bottom: 2px;
      color: var(--wizard-text);
      font-size: 0.72rem;
      font-weight: 700;
    }
    input, textarea, select {
      width: 100%;
      border-width: 1px;
      border-style: solid;
      border-color: var(--wizard-input-border) !important;
      border-radius: 8px;
      padding: 6px 8px;
      background: var(--wizard-input-bg);
      color: var(--wizard-text);
      font: inherit;
      font-size: 11px;
      line-height: 1.3;
      min-height: 34px;
      transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
    }
    textarea {
      min-height: 72px;
      resize: vertical;
      border-color: var(--wizard-input-border) !important;
    }
    select {
      padding-top: 6px;
      padding-bottom: 6px;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--wizard-accent);
      box-shadow: 0 0 0 3px rgba(95,127,184,0.16);
    }
    .wizard-invalid {
      border-color: rgba(191,61,61,0.55) !important;
      box-shadow: 0 0 0 3px rgba(191,61,61,0.12) !important;
      background: ${isDark ? '#1f1315' : '#fffafa'} !important;
    }
    .wizard-required-mark {
      color: var(--wizard-danger);
      margin-left: 4px;
    }
    input[type="radio"], input[type="checkbox"] {
      width: 12px;
      height: 12px;
      min-height: 12px;
      padding: 0;
      margin-right: 4px;
      vertical-align: middle;
      accent-color: var(--wizard-accent);
    }
    [class*="row"], [class*="grid"], .options, .choices {
      gap: 4px;
    }
    .form-group, .field, .input-group, .question, .section {
      margin-bottom: 4px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
    form > label, form > p, form > div, form > input, form > textarea, form > select, form > button {
      margin-bottom: 4px !important;
    }
    label + input, label + textarea, label + select {
      margin-top: 0 !important;
      margin-bottom: 5px !important;
    }
    ul, ol {
      margin: 6px 0;
      padding-left: 14px;
    }
    hr {
      margin: 10px 0;
      border: 0;
      border-top: 1px solid var(--wizard-border);
    }
    br + br { display: none; }
    button, input[type="submit"], input[type="button"], .button {
      appearance: none;
      border: none;
      border-radius: 999px;
      min-height: 34px;
      padding: 8px 10px;
      margin-top: 7px;
      background: linear-gradient(135deg, #17365f 0%, var(--wizard-accent) 100%);
      color: #ffffff;
      font: inherit;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: ${isDark ? '0 10px 18px rgba(0,0,0,0.24)' : '0 10px 18px rgba(23,54,95,0.14)'};
    }
    button[disabled], input[disabled] {
      opacity: 0.65;
      cursor: default;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    td, th {
      padding: 4px;
      border: 1px solid var(--wizard-border);
    }
    @media (max-width: 680px) {
      body { padding: 1px; }
      button, input[type="submit"], input[type="button"] { width: 100%; }
    }
  `;

  const script = `
    (function () {
      var HEIGHT_PREFIX = '__CAFA_WIZARD_HEIGHT__:';

      function postToHost(value) {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(value);
          return;
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(value, '*');
        }
      }

      function notifyHeight() {
        var doc = document.documentElement;
        var body = document.body;
        var height = Math.max(
          body ? body.scrollHeight : 0,
          body ? body.offsetHeight : 0,
          doc ? doc.scrollHeight : 0,
          doc ? doc.offsetHeight : 0
        );
        postToHost(HEIGHT_PREFIX + String(height));
      }

      function ready(fn) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
          fn();
        }
      }

      function isEligibleControl(el) {
        if (!el || el.disabled) return false;
        var tag = (el.tagName || '').toLowerCase();
        if (!['input', 'textarea', 'select'].includes(tag)) return false;
        var type = ((el.getAttribute('type') || '') + '').toLowerCase();
        return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
      }

      function hasFormControls(node) {
        return Boolean(node && node.querySelector && node.querySelector('input, textarea, select, button'));
      }

      function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
      }

      function isIntroCopy(text) {
        return /(^|\b)resume builder(\b|$)/i.test(text)
          || /(^|\b)cv builder(\b|$)/i.test(text)
          || /(^|\b)document builder(\b|$)/i.test(text)
          || /please\s+fill\s+out\s+the\s+form\s+below/i.test(text)
          || /fill\s+out\s+the\s+form\s+below\s+to\s+create\s+your\s+(resume|cv|document)/i.test(text)
          || /create\s+your\s+(resume|cv|document)/i.test(text);
      }

      function hideIntroNode(node) {
        if (!node || !node.style) return;
        node.style.display = 'none';
        var candidate = node;
        for (var depth = 0; depth < 3; depth += 1) {
          if (!candidate.parentElement) break;
          var parentText = normalizeText(candidate.parentElement.textContent || '');
          if (hasFormControls(candidate.parentElement)) break;
          if (!isIntroCopy(parentText)) break;
          candidate = candidate.parentElement;
        }
        if (candidate === node || hasFormControls(candidate)) return;
        candidate.style.display = 'none';
      }

      ready(function () {
        var form = document.querySelector('form');
        if (!form) return;
        form.setAttribute('aria-label', 'Document details form');

        var banner = document.createElement('div');
        banner.className = 'wizard-validation-banner';
        banner.id = 'wizard-validation-banner';
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'assertive');
        banner.textContent = 'Please complete every field before submitting.';
        if (form.parentNode) form.parentNode.insertBefore(banner, form);

        Array.prototype.slice.call(document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, span, label, p, div, small')).forEach(function (node) {
          var text = normalizeText(node.textContent || '');
          if (isIntroCopy(text)) {
            hideIntroNode(node);
          }
        });

        if (form.parentElement) {
          Array.prototype.slice.call(form.parentElement.children).forEach(function (child) {
            if (child === form || child === banner) return;
            if (hasFormControls(child)) return;
            var childText = normalizeText(child.textContent || '');
            if (isIntroCopy(childText)) {
              child.style.display = 'none';
            }
          });
        }

        var controls = Array.prototype.slice.call(form.querySelectorAll('input, textarea, select')).filter(isEligibleControl);

        controls.forEach(function (control) {
          var type = ((control.getAttribute('type') || '') + '').toLowerCase();
          if (!['radio', 'checkbox'].includes(type)) {
            control.setAttribute('required', 'required');
          }
          control.setAttribute('aria-required', 'true');
          control.addEventListener('input', function () {
            control.classList.remove('wizard-invalid');
            control.setAttribute('aria-invalid', 'false');
            banner.setAttribute('data-visible', 'false');
            notifyHeight();
          });
          control.addEventListener('change', function () {
            control.classList.remove('wizard-invalid');
            control.setAttribute('aria-invalid', 'false');
            banner.setAttribute('data-visible', 'false');
            notifyHeight();
          });
        });

        Array.prototype.slice.call(form.querySelectorAll('label')).forEach(function (label) {
          var targetId = label.getAttribute('for');
          var control = targetId ? document.getElementById(targetId) : label.querySelector('input, textarea, select');
          if (!isEligibleControl(control) || label.querySelector('.wizard-required-mark')) return;
          var star = document.createElement('span');
          star.className = 'wizard-required-mark';
          star.textContent = '*';
          label.appendChild(star);
        });

        form.addEventListener('submit', function (event) {
          var invalid = [];
          var radioNames = {};
          var checkboxNames = {};

          controls.forEach(function (control) {
            var type = ((control.getAttribute('type') || '') + '').toLowerCase();
            var name = control.getAttribute('name') || control.getAttribute('id') || '';
            control.classList.remove('wizard-invalid');

            if (type === 'radio') {
              if (!name || radioNames[name]) return;
              radioNames[name] = true;
              var group = form.querySelectorAll('input[type="radio"][name="' + CSS.escape(name) + '"]');
              var anyChecked = Array.prototype.slice.call(group).some(function (item) { return item.checked; });
              if (!anyChecked && group[0]) invalid.push(group[0]);
              return;
            }

            if (type === 'checkbox') {
              if (!name || checkboxNames[name]) return;
              checkboxNames[name] = true;
              var boxGroup = form.querySelectorAll('input[type="checkbox"][name="' + CSS.escape(name) + '"]');
              if (boxGroup.length <= 1) {
                if (!control.checked) invalid.push(control);
                return;
              }
              var anyCheckedBox = Array.prototype.slice.call(boxGroup).some(function (item) { return item.checked; });
              if (!anyCheckedBox && boxGroup[0]) invalid.push(boxGroup[0]);
              return;
            }

            if (!String(control.value || '').trim()) invalid.push(control);
          });

          if (!invalid.length) {
            banner.setAttribute('data-visible', 'false');
            notifyHeight();
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          banner.setAttribute('data-visible', 'true');
          invalid.forEach(function (control) {
            control.classList.add('wizard-invalid');
            control.setAttribute('aria-invalid', 'true');
            control.setAttribute('aria-describedby', 'wizard-validation-banner');
          });
          var first = invalid[0];
          if (first && typeof first.scrollIntoView === 'function') {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          if (first && typeof first.focus === 'function') {
            setTimeout(function () { first.focus(); }, 50);
          }
          notifyHeight();
        }, true);

        window.addEventListener('load', notifyHeight);
        window.addEventListener('resize', notifyHeight);
        if (window.MutationObserver) {
          new MutationObserver(function () {
            notifyHeight();
          }).observe(document.body, { childList: true, subtree: true, attributes: true });
        }
        setTimeout(notifyHeight, 0);
        setTimeout(notifyHeight, 250);
      });
    })();
  `;

  const styleTag = `<style id="cafa-document-wizard-inline-style">${css}</style>`;
  const scriptTag = `<script id="cafa-document-wizard-inline-script">${script}</script>`;
  const metaTag = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">';

  let nextHtml = sanitizedHtml;
  if (!/<meta[^>]+name=["']viewport["']/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(/<head([^>]*)>/i, `<head$1>${metaTag}`);
  }
  nextHtml = nextHtml.includes(styleTag)
    ? nextHtml
    : nextHtml.replace(/<\/head>/i, `${styleTag}</head>`);
  nextHtml = nextHtml.includes(scriptTag)
    ? nextHtml
    : nextHtml.replace(/<\/body>/i, `${scriptTag}</body>`);
  return nextHtml;
}
