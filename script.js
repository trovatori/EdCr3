/* ==========================================================
   EDIZIONE DIGITALE TEI — SCRIPT UNIFICATO
   (sostituisce integralmente il vecchio script.js)
========================================================== */

const TEI_FILE = 'ps.-dante.xml';
const NS = "http://www.tei-c.org/ns/1.0";

let globalXmlDoc = null;

/* ==========================================================
   INIZIALIZZAZIONE
========================================================== */

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  const status = document.getElementById('loading-indicator');

  try {
    const response = await fetch(TEI_FILE);
    if (!response.ok) throw new Error(`Errore caricamento XML: ${response.status}`);

    const text = await response.text();
    globalXmlDoc = new DOMParser().parseFromString(text, "application/xml");

    renderHeader(globalXmlDoc);
    renderFrontMatter(globalXmlDoc);
    renderWitnesses(globalXmlDoc);
    renderEdition(globalXmlDoc);
    renderTranslation(globalXmlDoc);
    renderFacsimile(globalXmlDoc);

    bindUIEvents();

    if (status) status.innerText = 'Pronto';
  } catch (e) {
    console.error(e);
    if (status) status.innerText = 'Errore';
  }
}

/* ==========================================================
   BINDING EVENTI (RIMOSSI DALL'HTML)
========================================================== */

function bindUIEvents() {

  /* Sidebar */
  bind('#btn-introduction', () => changeMainView('introduction', el('#btn-introduction')));
  bind('#btn-criteria',     () => changeMainView('criteria', el('#btn-criteria')));
  bind('#btn-witnesses',    () => changeMainView('witnesses', el('#btn-witnesses')));
  bind('#btn-edition',      () => changeMainView('edition', el('#btn-edition')));
  bind('#btn-bibliography', () => changeMainView('bibliography', el('#btn-bibliography')));

  /* Tabs */
  document.querySelectorAll('[data-pane]').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.closest('#col-left') ? 'col-left' : 'col-right';
      switchPane(col, btn.dataset.pane);
    });
  });

  /* TEI <app> e <seg> */
  document.body.addEventListener('click', e => {
    const app = e.target.closest('.tei-app');
    if (app) {
      syncTab('apparato');
      return;
    }

    const seg = e.target.closest('.tei-seg');
    if (seg) {
      const id = seg.getAttribute('data-seg-id') || seg.id?.replace('seg-','');
      syncTab('commento', id);
    }
  });

  /* Facsimile: drag / zoom / wheel */
  document.querySelectorAll('.fac-img-container').forEach(container => {
    const columnId = container.dataset.column;

    container.addEventListener('mousedown', e => startDrag(columnId, e));
    container.addEventListener('dblclick', () => resetZoom(columnId));
    container.addEventListener('wheel', e => handleWheel(columnId, e));
  });

  /* Dropdown facsimile */
  document.querySelectorAll('.dropdown-trigger').forEach(btn => {
    const col = btn.dataset.column;
    btn.addEventListener('click', e => toggleDropdown(col, e));
  });

  document.body.addEventListener('click', closeAllDropdowns);
}

/* ==========================================================
   RENDERING
========================================================== */

function renderHeader(xml) {
  const author = xml.getElementsByTagNameNS(NS,'author')[0]?.textContent || '';
  const title  = xml.getElementsByTagNameNS(NS,'title')[0]?.textContent || '';

  el('#header-meta').innerHTML = `
    <span class="header-author">${author}</span>
    <span class="header-title">${title}</span>
  `;
}

function renderFrontMatter(xml) {
  const intro = xml.querySelector('div[type="introduction"]');
  const crit  = xml.querySelector('div[type="criteria"]');

  if (intro) el('#view-introduction').innerHTML = intro.innerHTML;
  if (crit)  el('#view-criteria').innerHTML = crit.innerHTML;
}

function renderWitnesses(xml) {
  const wits = [...xml.getElementsByTagNameNS(NS,'witness')];
  let html = `<h1>Lista dei Testimoni</h1>`;

  wits.forEach(w => {
    html += `<p><strong>${w.getAttribute('xml:id')}</strong> — ${w.textContent}</p>`;
  });

  el('#view-witnesses').innerHTML = html;
}

function renderEdition(xml) {
  const edition = xml.querySelector('div[type="edition"]');
  let testo = '';
  let apparato = '';
  let commento = '';

  edition.querySelectorAll('lg').forEach(lg => {
    testo += `<div class="tei-lg">`;

    lg.querySelectorAll('l').forEach(l => {
      const n = l.getAttribute('n');
      let line = '';

      l.childNodes.forEach(node => {
        if (node.nodeType === 3) line += node.textContent;

        if (node.nodeType === 1 && node.localName === 'app') {
          const id = node.getAttribute('xml:id');
          const lem = node.querySelector('lem')?.textContent || '';
          line += `<span class="tei-app" data-app-id="${id}">${lem}</span>`;
          apparato += `<div id="app-${id}" class="p-2 border-b">${node.innerHTML}</div>`;
        }

        if (node.nodeType === 1 && node.localName === 'seg') {
          const sid = node.getAttribute('xml:id');
          line += `<span class="tei-seg" data-seg-id="${sid}">${node.textContent}</span>`;
        }
      });

      testo += `
        <div class="tei-l">
          <span class="line-n">${n}</span>${line}
        </div>`;
    });

    testo += `</div>`;
  });

  xml.querySelectorAll('note').forEach(n => {
    const id = n.getAttribute('target')?.replace('#','');
    commento += `<div id="note-${id}" class="note-box">${n.innerHTML}</div>`;
  });

  ['L','R'].forEach(s => {
    el(`#out-testo-${s}`).innerHTML = testo;
    el(`#out-apparato-${s}`).innerHTML = apparato;
    el(`#out-commento-${s}`).innerHTML = commento;
  });
}

function renderTranslation(xml) {
  const trans = xml.querySelector('div[type="translation"]');
  if (!trans) return;

  let html = '';
  trans.querySelectorAll('l').forEach(l => {
    html += `<div class="tei-l"><span class="line-n">${l.getAttribute('n')}</span>${l.textContent}</div>`;
  });

  el('#out-traduzione-L').innerHTML = html;
  el('#out-traduzione-R').innerHTML = html;
}

/* ==========================================================
   UI LOGIC (INVARIATA)
========================================================== */

function changeMainView(viewId, btn) {
  const body = el('#main-body');
  const leftTabs = el('#left-tabs');
  const editionPanes = el('#edition-panes-L');

  document.querySelectorAll('aside button').forEach(b => b.classList.remove('sidebar-btn-active'));
  btn.classList.add('sidebar-btn-active');

  document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden-pane'));

  if (viewId === 'edition') {
    body.classList.replace('layout-single','layout-dual');
    leftTabs.classList.remove('hidden-pane');
    editionPanes.classList.remove('hidden-pane');
    switchPane('col-left','testo');
    switchPane('col-right','apparato');
  } else {
    body.classList.replace('layout-dual','layout-single');
    leftTabs.classList.add('hidden-pane');
    editionPanes.classList.add('hidden-pane');
    el(`#view-${viewId}`).classList.remove('hidden-pane');
  }
}

function switchPane(columnId, paneName) {
  const col = el('#'+columnId);
  const root = columnId === 'col-left' ? el('#edition-panes-L') : col;

  col.querySelectorAll('[data-pane]').forEach(b => {
    b.classList.toggle('tab-active', b.dataset.pane === paneName);
  });

  root.querySelectorAll('[id^="out-"]').forEach(p => {
    p.classList.toggle('hidden-pane', !p.id.includes(paneName));
  });
}

function syncTab(pane, id) {
  if (el('#main-body').classList.contains('layout-single')) {
    changeMainView('edition', el('#btn-edition'));
  }
  switchPane('col-right', pane);
  if (id) {
    setTimeout(() => el(`#note-${id}`)?.scrollIntoView({behavior:'smooth', block:'center'}), 150);
  }
}

/* ==========================================================
   UTILITIES
========================================================== */

function el(sel){ return document.querySelector(sel); }
function bind(sel, fn){ const e=el(sel); if(e) e.addEventListener('click',fn); }