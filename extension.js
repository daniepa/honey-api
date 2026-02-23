const vscode = require('vscode');

function activate(context) {
  let disposable = vscode.commands.registerCommand(
    'honey-api.open',
    function () {

      const panel = vscode.window.createWebviewPanel(
        'apiClient',
        'API Client',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      // init storage
      if (!context.workspaceState.get('collections')) {
        context.workspaceState.update('collections', []);
      }

      panel.webview.onDidReceiveMessage(async message => {

        let collections = context.workspaceState.get('collections') || [];

        if (message.command === 'sendRequest') {
          const result = await makeRequest(message);
          panel.webview.postMessage({
            command: 'response',
            status: result.status,
            body: result.body
          });
        }

        if (message.command === 'getCollections') {
          panel.webview.postMessage({
            command: 'collections',
            data: collections
          });
        }

        if (message.command === 'addCollection') {
          vscode.window.showInputBox({ prompt: 'Collection name' }).then(name => {
            if (!name) return;

            const newCollection = {
              id: Date.now().toString(),
              name,
              requests: []
            };

            collections.push(newCollection);
            context.workspaceState.update('collections', collections);

            panel.webview.postMessage({
              command: 'collections',
              data: collections,
              selectCollectionId: newCollection.id
            });
          });
        }

        if (message.command === 'renameCollection') {
          const c = collections.find(c => c.id === message.id);
          if (!c) return;

          vscode.window.showInputBox({ prompt: 'New collection name', value: c.name }).then(name => {
            if (!name) return;
            c.name = name;
            context.workspaceState.update('collections', collections);
            panel.webview.postMessage({ command: 'collections', data: collections });
          });
        }

        if (message.command === 'deleteCollection') {
          collections = collections.filter(c => c.id !== message.id);
          context.workspaceState.update('collections', collections);
          panel.webview.postMessage({ command: 'collections', data: collections });
        }

        if (message.command === 'addRequest') {
          if (!collections.find(c => c.id === message.collectionId)) return;

          vscode.window.showInputBox({ prompt: 'Request name', value: 'New Request' }).then(name => {
            if (!name) return;

            let newRequest;
            collections = collections.map(c => {
              if (c.id === message.collectionId) {
                newRequest = {
                  id: Date.now().toString(),
                  name,
                  method: 'GET',
                  url: '',
                  headers: '{}',
                  body: '{}'
                };
                c.requests.push(newRequest);
              }
              return c;
            });

            context.workspaceState.update('collections', collections);

            panel.webview.postMessage({
              command: 'collections',
              data: collections,
              selectCollectionId: message.collectionId,
              selectRequestId: newRequest.id
            });
          });
        }

        if (message.command === 'renameRequest') {
          collections = collections.map(c => {
            if (c.id === message.collectionId) {
              const r = c.requests.find(r => r.id === message.requestId);
              if (!r) return c;
              vscode.window.showInputBox({ prompt: 'New request name', value: r.name }).then(name => {
                if (!name) return;
                r.name = name;
                context.workspaceState.update('collections', collections);
                panel.webview.postMessage({
                  command: 'collections',
                  data: collections,
                  selectCollectionId: c.id,
                  selectRequestId: r.id
                });
              });
            }
            return c;
          });
        }

        if (message.command === 'deleteRequest') {
          collections = collections.map(c => {
            if (c.id === message.collectionId) {
              c.requests = c.requests.filter(r => r.id !== message.requestId);
            }
            return c;
          });
          context.workspaceState.update('collections', collections);
          panel.webview.postMessage({ command: 'collections', data: collections });
        }

        if (message.command === 'updateRequest') {
          collections = collections.map(c => {
            if (c.id === message.collectionId) {
              c.requests = c.requests.map(r =>
                r.id === message.request.id ? message.request : r
              );
            }
            return c;
          });
          context.workspaceState.update('collections', collections);
          panel.webview.postMessage({ command: 'collections', data: collections });
        }

      });

      panel.webview.html = getHtml();
    }
  );

  context.subscriptions.push(disposable);
}

async function makeRequest({ url, method, headers, body }) {
  try {
    const options = { method, headers: {} };

    if (headers) {
      try { options.headers = JSON.parse(headers); } catch { return { status: 0, body: 'Headers JSON non valido' }; }
    }
    if (method !== 'GET' && body) {
      try { options.body = JSON.stringify(JSON.parse(body));
        if (!options.headers['Content-Type']) options.headers['Content-Type']='application/json';
      } catch { return { status: 0, body: 'Body JSON non valido'}; }
    }

    const res = await fetch(url, options);
    const text = await res.text();
    return { status: res.status, body: text };

  } catch(err) { return { status: 0, body: err.message }; }
}
function getHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: sans-serif;
  background: #1e1e1e;
  color: white;
}

/* HEADER */
.header {
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #e5c822;
}

.header h1 {
  font-size: 2.2em;
}

/* MAIN LAYOUT */
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
  flex-wrap: wrap;
}

/* COLUMNS */
.col {
  padding: 10px;
  overflow: auto;
}

.left {
  width: 20%;
  min-width: 220px;
}

.center {
  width: 40%;
  min-width: 400px;
}

.right {
  flex: 1;
  border-left: 1px solid #555;
  display: flex;
  flex-direction: column;

  min-width: 300px;
}

/* LIST */
ul {
  padding: 0;
  margin: 0;
}

li {
  list-style: none;
  padding: 6px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

li:hover {
  background: #a6a239;
}

.active-item {
  background: #e5c822;
  color: black;
}

/* BUTTONS */
button {
  cursor: pointer;
  margin-left: 5px;
}

select, button.primary {
  height: 40px;
  background-color: #e5c822;
  color: white;
  border: none;
  border-radius: 5px;
}

/* INPUT */
input {
  height: 40px;
  border-radius: 5px;
  border: none;
  padding: 0 10px;
}

/* TABS */
.tabs {
  display: flex;
  gap: 15px;
  margin-top: 10px;
}

.tab {
  cursor: pointer;
  padding-bottom: 5px;
}

.tab.active {
  font-weight: bold;
  border-bottom: 3px solid #e5c822;
}

/* TEXTAREA */
textarea {
  width: 100%;
  height: 200px;
  background: #2d2d2d;
  color: white;
  border: none;
  padding: 10px;
  margin-top: 10px;
}

/* RESPONSE */
.response {
  flex: 1;
  display: flex;
  flex-direction: column;
}

#out {
  flex: 1;
  background-color: #363636;
  padding: 10px;
  overflow: auto;
  color: #fff;
  margin-top: 10px;
}

#addCollectionBtn, #addRequestBtn {
  width: 35px;
  height: 35px;
  border-radius: 50%;
}

</style>
</head>

<body>

<div class="header">
  <h1>🍯Honey <span style="color:white">API</span> 🐝 <span style="font-size:12px;">v 1.0</span></h1>
</div>

<div class="main">

  <!-- LEFT -->
  <div class="col left">
    <h2>Collections</h2>
    <button id="addCollectionBtn">➕</button>
    <ul id="collections"></ul>

    <hr />

    <div id="requestsSection" style="display:none;">
      <h4>Requests</h4>
      <button id="addRequestBtn">➕</button>
      <ul id="requests"></ul>
    </div>
  </div>

  <!-- CENTER -->
  <div class="col center">

    <div style="display:flex; gap:10px;">
      <select id="method" style="width:20%;">
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>DELETE</option>
      </select>

      <input id="url" style="flex:1;" placeholder="https://..." />

      <button id="sendBtn" class="primary">Send</button>
    </div>

    <div class="tabs">
      <span class="tab active" data-tab="headers">Headers</span>
      <span class="tab" data-tab="body">Body</span>
    </div>

    <div id="headersTab">
      <textarea id="headers">{}</textarea>
    </div>

    <div id="bodyTab" style="display:none;">
      <textarea id="body">{}</textarea>
    </div>

  </div>

  <!-- RIGHT -->
  <div class="col right">
    <div class="response">
      <h2>Response</h2>
      <h3 id="status"></h3>
      <pre id="out"></pre>
    </div>
  </div>

</div>

<script>

const vscode = acquireVsCodeApi();

let collections = [];
let currentCollection = null;
let currentRequest = null;

const collectionsEl = document.getElementById('collections');
const requestsEl = document.getElementById('requests');
const requestsSection = document.getElementById('requestsSection');

const methodEl = document.getElementById('method');
const urlEl = document.getElementById('url');
const headersEl = document.getElementById('headers');
const bodyEl = document.getElementById('body');

const statusEl = document.getElementById('status');
const outEl = document.getElementById('out');

/* ---------------- TABS ---------------- */

document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('headersTab').style.display = 'none';
    document.getElementById('bodyTab').style.display = 'none';

    document.getElementById(tab.dataset.tab + 'Tab').style.display = 'block';
  };
});

/* ---------------- ACTIONS ---------------- */

document.getElementById('addCollectionBtn').onclick = () => {
  vscode.postMessage({ command: 'addCollection' });
};

document.getElementById('addRequestBtn').onclick = () => {
  if (!currentCollection) return;
  vscode.postMessage({ command: 'addRequest', collectionId: currentCollection.id });
};

document.getElementById('sendBtn').onclick = () => {
  if (!currentRequest) return;

  currentRequest.method = methodEl.value;
  currentRequest.url = urlEl.value;
  currentRequest.headers = headersEl.value;
  currentRequest.body = bodyEl.value;

  vscode.postMessage({
    command: 'updateRequest',
    collectionId: currentCollection.id,
    request: currentRequest
  });

  vscode.postMessage({
    command: 'sendRequest',
    url: currentRequest.url,
    method: currentRequest.method,
    headers: currentRequest.headers,
    body: currentRequest.body
  });
};

/* ---------------- RENDER ---------------- */

function render() {

  collectionsEl.innerHTML = '';

  collections.forEach(c => {

    const li = document.createElement('li');

    if (currentCollection && currentCollection.id === c.id) {
      li.classList.add('active-item');
    }

    const name = document.createElement('span');
    name.textContent = c.name;

    const actions = document.createElement('div');

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✏️';
    renameBtn.onclick = e => {
      e.stopPropagation();
      vscode.postMessage({ command: 'renameCollection', id: c.id });
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.onclick = e => {
      e.stopPropagation();
      vscode.postMessage({ command: 'deleteCollection', id: c.id });
    };

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    li.appendChild(name);
    li.appendChild(actions);

    li.onclick = () => selectCollection(c.id);

    collectionsEl.appendChild(li);
  });

  if (!currentCollection) return;

  requestsSection.style.display = 'block';
  requestsEl.innerHTML = '';

  currentCollection.requests.forEach(r => {

    const li = document.createElement('li');

    if (currentRequest && currentRequest.id === r.id) {
      li.classList.add('active-item');
    }

    const name = document.createElement('span');
    name.textContent = r.name;

    const actions = document.createElement('div');

    const renameBtn = document.createElement('button');
    renameBtn.textContent = '✏️';
    renameBtn.onclick = e => {
      e.stopPropagation();
      vscode.postMessage({
        command: 'renameRequest',
        collectionId: currentCollection.id,
        requestId: r.id
      });
    };

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.onclick = e => {
      e.stopPropagation();
      vscode.postMessage({
        command: 'deleteRequest',
        collectionId: currentCollection.id,
        requestId: r.id
      });
    };

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    li.appendChild(name);
    li.appendChild(actions);

    li.onclick = () => selectRequest(r.id);

    requestsEl.appendChild(li);
  });
}

/* ---------------- SELECT ---------------- */

function selectCollection(id) {
  currentCollection = collections.find(c => c.id === id);
  currentRequest = null;
  render();
}

function selectRequest(id) {
  currentRequest = currentCollection.requests.find(r => r.id === id);

  methodEl.value = currentRequest.method;
  urlEl.value = currentRequest.url;
  headersEl.value = currentRequest.headers;
  bodyEl.value = currentRequest.body;

  render();
}

/* ---------------- MESSAGES ---------------- */

window.addEventListener('message', event => {

  const msg = event.data;

  if (msg.command === 'collections') {
    collections = msg.data;

    if (msg.selectCollectionId) {
      currentCollection = collections.find(c => c.id === msg.selectCollectionId);
    }

    if (msg.selectRequestId && currentCollection) {
      currentRequest = currentCollection.requests.find(r => r.id === msg.selectRequestId);
    }

    render();
  }

  if (msg.command === 'response') {
    let color = 'white';

    if (msg.status >= 200 && msg.status < 300) color = 'green';
    else if (msg.status >= 400) color = 'red';

    statusEl.textContent = 'Status: ' + msg.status;
    statusEl.style.color = color;

    try {
      outEl.textContent = JSON.stringify(JSON.parse(msg.body), null, 2);
    } catch {
      outEl.textContent = msg.body;
    }
  }
});

/* INIT */
vscode.postMessage({ command: 'getCollections' });

</script>

</body>
</html>
`;
}

function deactivate(){}

module.exports={activate,deactivate};