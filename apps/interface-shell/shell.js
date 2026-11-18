// Interface-only state. Each action has a stable name for a future feature module.
const groups = {
  Archivo: { Documento: [['open', 'Abrir'], ['save', 'Guardar'], ['export-html', 'Exportar HTML'], ['examples', 'Abrir ejemplo']] },
  Inicio: { Estilos: [['h1', 'Título 1'], ['h2', 'Título 2'], ['h3', 'Título 3']], Formato: [['bold', 'Negrita'], ['italic', 'Cursiva'], ['code', 'Código'], ['quote', 'Cita'], ['list', 'Lista'], ['rule', 'Separador']] },
  Insertar: { Contenido: [['formula', 'Fórmula'], ['table', 'Tabla'], ['picture', 'Imagen']], Gráficos: [['graph', 'Gráficos y superficies']] },
  Matemáticas: { Notación: [['equation', 'Ecuación'], ['inline-math', 'Fórmula en línea'], ['matrix', 'Matriz'], ['integral', 'Integral']], Interactividad: [['slider', 'Parámetro']] },
  Datos: { 'Datos y análisis': [['data-table', 'Tabla de datos'], ['vectorfield', 'Campo vectorial'], ['riemann', 'Riemann']] },
  Vista: { 'Modo de lectura': [['view-editor', 'Editor'], ['view-split', 'Dividido'], ['view-reader', 'Lector']], Paneles: [['outline', 'Esquema'], ['inspector', 'Inspector']], Herramientas: [['commands', 'Comandos']] },
};

const app = document.querySelector('#app');
const editor = document.querySelector('#editor');
const tabs = document.querySelector('#document-tabs');
const sidebar = document.querySelector('#sidebar');
const status = document.querySelector('#status');
const documents = [{ id: 1, name: 'Sin título.bwjm', content: '' }];
let nextId = 2;
let activeId = 1;
let ribbonTab = 'Inicio';
let sidebarTab = 'outline';
let view = 'split';
let statusTimer;

function currentDocument() { return documents.find(document => document.id === activeId); }

function notify(message) {
  status.textContent = message;
  status.classList.add('visible');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => status.classList.remove('visible'), 3500);
}

function renderDocuments() {
  tabs.replaceChildren();
  for (const tabDocument of documents) {
    const item = document.createElement('div');
    item.className = 'bwjm-document-tab' + (tabDocument.id === activeId ? ' active' : '');
    const select = document.createElement('button');
    select.type = 'button';
    select.setAttribute('role', 'tab');
    select.id = 'tab-' + tabDocument.id;
    select.setAttribute('aria-selected', String(tabDocument.id === activeId));
    select.textContent = '▤  ' + tabDocument.name;
    select.title = 'Doble clic para cambiar el nombre';
    select.addEventListener('click', () => selectDocument(tabDocument.id));
    select.addEventListener('dblclick', () => renameDocument(tabDocument.id));
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.className = 'bwjm-tab-rename';
    rename.setAttribute('aria-label', 'Renombrar ' + tabDocument.name);
    rename.textContent = '✎';
    rename.addEventListener('click', () => renameDocument(tabDocument.id));
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bwjm-tab-close';
    close.setAttribute('aria-label', 'Cerrar ' + tabDocument.name);
    close.textContent = '×';
    close.addEventListener('click', () => closeDocument(tabDocument.id));
    item.append(select, rename, close);
    tabs.append(item);
  }
  const active = currentDocument();
  editor.value = active.content;
  document.querySelector('#active-name').textContent = active.name;
  updateCount();
}

function selectDocument(id) {
  activeId = id;
  renderDocuments();
}

function renameDocument(id) {
  const documentToRename = documents.find(document => document.id === id);
  const name = window.prompt('Nombre del documento', documentToRename.name);
  if (name?.trim()) {
    documentToRename.name = name.trim();
    renderDocuments();
  }
}

function closeDocument(id) {
  if (documents.length === 1) {
    notify('Crea otra pestaña antes de cerrar la última.');
    return;
  }
  const index = documents.findIndex(document => document.id === id);
  documents.splice(index, 1);
  if (activeId === id) activeId = documents[Math.min(index, documents.length - 1)].id;
  renderDocuments();
}

function updateCount() {
  document.querySelector('.bwjm-char-count').textContent = editor.value.length + ' caracteres';
  if (sidebarTab === 'outline') renderSidebarContent();
}

function renderRibbon() {
  const tabList = document.querySelector('#ribbon-tabs');
  const content = document.querySelector('#ribbon-content');
  tabList.replaceChildren();
  for (const name of Object.keys(groups)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bwjm-ribbon-tab' + (name === ribbonTab ? ' selected' : '');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(name === ribbonTab));
    button.textContent = name;
    button.addEventListener('click', () => {
      ribbonTab = name;
      content.hidden = false;
      document.querySelector('#collapse-ribbon').setAttribute('aria-expanded', 'true');
      renderRibbon();
    });
    tabList.append(button);
  }
  content.replaceChildren();
  content.setAttribute('aria-label', 'Herramientas de ' + ribbonTab);
  for (const [label, actions] of Object.entries(groups[ribbonTab])) {
    const group = document.createElement('div');
    group.className = 'bwjm-ribbon-group';
    const buttons = document.createElement('div');
    buttons.className = 'bwjm-ribbon-buttons';
    for (const [id, title] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bwjm-ribbon-action' + (id === 'view-' + view ? ' active' : '');
      button.dataset.action = id;
      button.textContent = title;
      button.addEventListener('click', () => runAction(id, title));
      buttons.append(button);
    }
    const caption = document.createElement('span');
    caption.className = 'bwjm-ribbon-group-label';
    caption.textContent = label;
    group.append(buttons, caption);
    content.append(group);
  }
}

function renderSidebarContent() {
  const content = document.querySelector('#sidebar-content');
  content.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'shell-empty';
  if (sidebarTab === 'outline') {
    const headings = editor.value.split('\n').filter(line => /^#{1,3} /.test(line));
    if (headings.length) {
      for (const heading of headings) {
        const item = document.createElement('p');
        item.textContent = heading.replace(/^#+ /, '');
        content.append(item);
      }
      return;
    }
    empty.textContent = 'Agrega títulos con # para crear tu esquema.';
  } else if (sidebarTab === 'variables') {
    empty.textContent = 'Variables del documento';
  } else {
    empty.textContent = 'Inspector del documento';
  }
  content.append(empty);
}

function renderSidebar() {
  const list = document.querySelector('#sidebar-tabs');
  list.replaceChildren();
  for (const [id, label] of [['outline', 'Esquema'], ['variables', 'Variables'], ['inspector', 'Inspector']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bwjm-document-sidebar-tab' + (id === sidebarTab ? ' active' : '');
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(id === sidebarTab));
    button.textContent = label;
    button.addEventListener('click', () => {
      sidebarTab = id;
      sidebar.className = 'bwjm-sidebar-left bwjm-document-sidebar bwjm-sidebar-mode-expanded';
      renderSidebar();
    });
    list.append(button);
  }
  renderSidebarContent();
}

function setView(mode) {
  view = mode;
  app.classList.remove('mode-editor', 'mode-reader', 'mode-split');
  app.classList.add('mode-' + mode);
  document.querySelector('#bwjm-editor-panel').hidden = mode === 'reader';
  document.querySelector('#bwjm-reader-panel').hidden = mode === 'editor';
  renderRibbon();
}

function runAction(id, label) {
  if (id.startsWith('view-')) return setView(id.slice(5));
  if (id === 'outline' || id === 'inspector') {
    sidebarTab = id;
    sidebar.className = 'bwjm-sidebar-left bwjm-document-sidebar bwjm-sidebar-mode-expanded';
    renderSidebar();
    return;
  }
  // Feature modules can replace this notification by registering a handler for id.
  notify(label + ' · función pendiente de conectar');
}

editor.addEventListener('input', () => {
  currentDocument().content = editor.value;
  updateCount();
});
document.querySelector('#new-tab').addEventListener('click', () => {
  const id = nextId++;
  documents.push({ id, name: 'Sin título ' + id + '.bwjm', content: '' });
  selectDocument(id);
});
document.querySelector('#toggle-sidebar').addEventListener('click', () => {
  sidebar.classList.toggle('bwjm-sidebar-mode-hidden');
});
document.querySelector('#close-sidebar').addEventListener('click', () => sidebar.classList.add('bwjm-sidebar-mode-hidden'));
document.querySelector('#collapse-sidebar').addEventListener('click', () => sidebar.classList.toggle('bwjm-sidebar-mode-collapsed'));
document.querySelector('#collapse-ribbon').addEventListener('click', event => {
  const content = document.querySelector('#ribbon-content');
  content.hidden = !content.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!content.hidden));
  event.currentTarget.querySelector('span').textContent = content.hidden ? 'Mostrar' : 'Ocultar';
});
document.querySelector('.shell-search input').addEventListener('input', event => {
  const query = event.target.value;
  if (!query) return;
  const index = editor.value.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index >= 0) {
    setView('editor');
    editor.focus();
    editor.setSelectionRange(index, index + query.length);
  }
});
renderDocuments();
renderRibbon();
renderSidebar();
