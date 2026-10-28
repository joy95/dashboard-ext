/* 主程序：启动、默认布局、工具栏、添加面板、设置、主题与整页自动刷新 */

// ---- 通用弹窗 ----
const Modal = {
  open({ title, body = "", onMount }) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-backdrop"><div class="modal">
      <div class="modal-head"><span>${escHtml(title)}</span><button class="modal-close">×</button></div>
      <div class="modal-body"></div></div></div>`;
    const bodyEl = root.querySelector(".modal-body");
    if (body) bodyEl.innerHTML = body;
    root.querySelector(".modal-close").onclick = () => Modal.close();
    root.querySelector(".modal-backdrop").onclick = (e) => {
      if (e.target.classList.contains("modal-backdrop")) Modal.close();
    };
    if (onMount) onMount(bodyEl);
  },
  close() {
    document.getElementById("modal-root").innerHTML = "";
  },
};
window.Modal = Modal;

const escHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ---- 默认布局（首次使用）----
function seed() {
  return [
    Widgets.create("clock"),
    Widgets.create("calendar"),
    Widgets.create("todo"),
    Widgets.create("notes"),
    Widgets.create("links"),
  ];
}

// ---- 主题 ----
function applyTheme() {
  const t = Store.getSettings().theme || "olive-dark";
  document.documentElement.dataset.theme = t;
}

// ---- 整页自动刷新 ----
let arTimer = null;
function setupGlobalAutoRefresh() {
  if (arTimer) {
    clearInterval(arTimer);
    arTimer = null;
  }
  const ar = Store.getSettings().autoRefresh;
  if (ar && ar.enabled) {
    arTimer = setInterval(() => location.reload(), Math.max(1, ar.interval) * 60000);
  }
}

// ---- 添加面板 ----
function openPicker() {
  const items = Widgets.list();
  let body = `<div class="picker-grid">`;
  for (const it of items) {
    body += `<div class="picker-card" data-type="${it.type}">
      <div class="pc-icon">${it.icon}</div>
      <div class="pc-name">${escHtml(it.name)}</div>
      <div class="pc-desc">${escHtml(it.desc)}</div>
    </div>`;
  }
  body += `</div>`;
  Modal.open({
    title: "添加小组件",
    body,
    onMount: (c) => {
      c.querySelectorAll(".picker-card").forEach((card) => {
        card.onclick = () => {
          const type = card.dataset.type;
          const w = Widgets.create(type);
          const arr = Store.getWidgets();
          arr.push(w);
          Store.setWidgets(arr);
          Store.save();
          Modal.close();
          Grid.render();
          const def = Widgets.get(type);
          if (def.configurable) Grid.openSettings(w);
        };
      });
    },
  });
}

// ---- 设置面板 ----
function openSettingsModal() {
  const s = Store.getSettings();
  const body = `
    <div class="field"><label>主题</label>
      <select id="set-theme">
        <option value="olive-dark" ${
          s.theme === "olive-dark" ? "selected" : ""
        }>橄榄绿（暗）</option>
        <option value="light" ${
          s.theme === "light" ? "selected" : ""
        }>浅色</option>
      </select>
    </div>
    <div class="toggle-row">
      <div>
        <div>整页自动刷新</div>
        <div class="hint">定期重载仪表盘页面（含所有内嵌网站），默认关闭</div>
      </div>
      <label class="switch"><input type="checkbox" id="set-ar" ${
        s.autoRefresh.enabled ? "checked" : ""
      }/><span class="slider"></span></label>
    </div>
    <div class="field" id="set-ar-int" style="${
      s.autoRefresh.enabled ? "" : "display:none"
    }">
      <label>刷新间隔（分钟）</label>
      <input type="number" id="set-ar-int-v" min="1" max="1440" value="${
        s.autoRefresh.interval
      }"/>
    </div>
    <div class="modal-foot">
      <button class="btn btn-danger" id="set-reset">恢复默认布局</button>
      <button class="btn btn-primary" id="set-save">保存</button>
    </div>`;
  Modal.open({
    title: "设置",
    body,
    onMount: (c) => {
      const ar = c.querySelector("#set-ar");
      ar.onchange = () => {
        c.querySelector("#set-ar-int").style.display = ar.checked ? "" : "none";
      };
      c.querySelector("#set-save").onclick = () => {
        const theme = c.querySelector("#set-theme").value;
        const enabled = c.querySelector("#set-ar").checked;
        const interval = Math.max(
          1,
          Number(c.querySelector("#set-ar-int-v").value) || 30
        );
        Store.setSettings({ theme, autoRefresh: { enabled, interval } });
        Store.save();
        applyTheme();
        Modal.close();
        setupGlobalAutoRefresh();
      };
      c.querySelector("#set-reset").onclick = async () => {
        if (!confirm("将清空所有小组件并恢复默认布局，确定？")) return;
        Store.setWidgets(seed());
        await Store.save();
        Modal.close();
        Grid.render();
      };
    },
  });
}

// ---- 配置备份 / 迁移 ----
function normalizeWidget(raw) {
  const def = Widgets.get(raw && raw.type);
  if (!def) return null;
  const base = Widgets.create(raw.type);
  return {
    id: raw.id && typeof raw.id === "string" ? raw.id : base.id,
    type: raw.type,
    title: raw.title || base.title,
    span:
      Array.isArray(raw.span) &&
      raw.span.length === 2 &&
      raw.span.every(Number.isFinite)
        ? raw.span.slice()
        : base.span.slice(),
    config: Object.assign(
      {},
      base.config,
      raw.config && typeof raw.config === "object" ? raw.config : {}
    ),
  };
}

function exportConfig() {
  const data = {
    app: "custom-dashboard",
    version: 1,
    exportedAt: new Date().toISOString(),
    widgets: Store.getWidgets(),
    settings: Store.getSettings(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dashboard-config-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.widgets)) {
        throw new Error("文件格式不正确：缺少 widgets 数组");
      }
      if (!confirm("导入将覆盖当前所有小组件与设置，确定继续？")) return;
      const widgets = data.widgets.map(normalizeWidget).filter(Boolean);
      Store.setWidgets(widgets);
      if (data.settings && typeof data.settings === "object") {
        Store.setSettings(data.settings);
      }
      Store.save().then(() => {
        applyTheme();
        Grid.render();
        Modal.close();
        alert("配置导入成功，共 " + widgets.length + " 个组件。");
      });
    } catch (e) {
      alert("导入失败：" + e.message);
    }
  };
  reader.onerror = () => alert("读取文件失败");
  reader.readAsText(file);
}

// ---- 工具栏 ----
function wireToolbar() {
  const editBtn = document.getElementById("btn-edit");
  editBtn.onclick = () => {
    const next = !Grid.isEdit();
    Grid.setEditing(next);
    editBtn.textContent = next ? "完成" : "编辑";
    editBtn.classList.toggle("btn-primary", next);
  };
  document.getElementById("btn-add").onclick = openPicker;
  document.getElementById("btn-settings").onclick = openSettingsModal;
  document.getElementById("btn-refresh-all").onclick = () => location.reload();
  const importFile = document.getElementById("import-file");
  document.getElementById("btn-export").onclick = exportConfig;
  document.getElementById("btn-import").onclick = () => importFile.click();
  importFile.onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importConfig(f);
    e.target.value = "";
  };
}

// ---- 启动 ----
(async function boot() {
  await Store.load();
  if (Store.get().widgets === null) {
    Store.setWidgets(seed());
    await Store.save();
  }
  applyTheme();
  Grid.render();
  wireToolbar();
  setupGlobalAutoRefresh();
})();
