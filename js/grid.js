/* 网格：基于 gridstack.js（与 react-grid-layout 同类，自由摆放 / 整卡可拖 / 按钮不触发 / resize / 碰撞让位）
 * 复刻 mini-chrome-ext (OpenWork) 的拖拽体验：
 *  - 12 列、正方形单元格、compactType=null(自由摆放, float:true)
 *  - 拖拽手柄 = 编辑条(.widget-edit-bar)，按钮/输入不触发拖拽(draggable.cancel)
 *  - 编辑态才可拖拽/缩放(isDraggable=isEditing)
 *  - 数据模型对齐 RGL 的 {i,x,y,w,h} → 此处 {id,type,x,y,w,h}
 */
const Grid = (() => {
  const COLS = 12;
  const CELL_H = 90;
  const MARGIN = 14;
  let isEditing = false;
  let grid = null;
  let container = null;

  const escapeHtml = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function cleanup() {
    document
      .querySelectorAll("#grid .widget-content")
      .forEach((c) => c._cleanup && c._cleanup());
  }

  // ---- 历史遗留重叠的自愈（按 y,x 顺序安放，重叠则下移）----
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }
  function healLayout() {
    const list = Store.getWidgets()
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [];
    let changed = false;
    for (const it of list) {
      let guard = 0;
      let hit;
      while (guard++ < 200 && (hit = placed.find((p) => rectsOverlap(it, p)))) {
        it.y = hit.y + hit.h;
        changed = true;
      }
      placed.push(it);
    }
    return changed;
  }

  // 探测空闲位置，避免新组件与已有组件重叠
  function findFreeSpot(w, h) {
    const occ = {};
    Store.getWidgets().forEach((it) => {
      for (let yy = it.y; yy < it.y + it.h; yy++)
        for (let xx = it.x; xx < it.x + it.w; xx++) occ[xx + "," + yy] = 1;
    });
    const maxBottom = Store.getWidgets().reduce(
      (m, it) => Math.max(m, it.y + it.h),
      0
    );
    for (let y = 0; y <= maxBottom + 1; y++) {
      for (let x = 0; x <= COLS - w; x++) {
        let ok = true;
        for (let yy = y; yy < y + h; yy++) {
          for (let xx = x; xx < x + w; xx++) {
            if (occ[xx + "," + yy]) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (ok) return [x, y];
      }
    }
    return [0, maxBottom + 1];
  }

  function editBarHtml(w, def) {
    return `<div class="widget-edit-bar">
      <span class="drag-handle" title="拖动移动位置">⠿</span>
      <span class="w-title">${def.icon} ${escapeHtml(w.title)}</span>
      <span class="w-actions">
        ${
          def.configurable
            ? '<button data-act="settings" title="设置">⚙</button>'
            : ""
        }
        <button data-act="del" title="删除">🗑</button>
      </span>
    </div>`;
  }

  function buildInner(w) {
    const def = Widgets.get(w.type);
    if (!def) return document.createElement("div");
    const widget = document.createElement("div");
    widget.className = "widget";
    widget.dataset.id = w.id;
    widget.dataset.type = w.type;
    if (isEditing) widget.innerHTML = editBarHtml(w, def);
    const content = document.createElement("div");
    content.className = "widget-content";
    widget.appendChild(content);
    try {
      def.render(content, w, api());
    } catch (e) {
      content.innerHTML = `<div class="empty-state">组件渲染失败：${escapeHtml(
        e.message
      )}</div>`;
    }
    return widget;
  }

  function wireItem(w, itemEl) {
    const wEl = itemEl.querySelector(".widget");
    const del = wEl.querySelector('[data-act="del"]');
    if (del)
      del.onclick = () => {
        if (!confirm(`删除「${w.title}」？`)) return;
        Store.setWidgets(Store.getWidgets().filter((x) => x.id !== w.id));
        Store.save();
        if (grid) grid.removeWidget(itemEl, true, false);
      };
    const set = wEl.querySelector('[data-act="settings"]');
    if (set) set.onclick = () => openSettings(w);
  }

  function mount() {
    container = document.getElementById("grid");
    const GS = window.GridStack;
    if (grid) {
      grid.destroy(false);
      grid = null;
    }
    container.innerHTML = "";
    grid = GS.init(
      {
        column: COLS,
        cellHeight: CELL_H,
        margin: MARGIN,
        float: true, // 自由摆放（对应 RGL compactType=null）
        disableOneColumnMode: true,
        animate: true,
        handle: ".widget-edit-bar",
        draggable: {
          handle: ".widget-edit-bar",
          cancel: "button, input, textarea, a, select, .no-drag",
        },
        resizable: { handles: "se" },
      },
      container
    );

    if (healLayout()) Store.save();

    Store.getWidgets().forEach((w) => {
      const item = document.createElement("div");
      item.className = "grid-stack-item";
      item.setAttribute("gs-id", w.id);
      item.setAttribute("gs-x", w.x);
      item.setAttribute("gs-y", w.y);
      item.setAttribute("gs-w", w.w);
      item.setAttribute("gs-h", w.h);
      const inner = document.createElement("div");
      inner.className = "grid-stack-item-content";
      inner.appendChild(buildInner(w));
      item.appendChild(inner);
      container.appendChild(item);
      grid.makeWidget(item);
      if (isEditing) wireItem(w, item);
    });

    grid.enableMove(isEditing);
    grid.enableResize(isEditing);
    container.classList.toggle("editing", isEditing);

    grid.on("change", (_e, items) => {
      for (const it of items || []) {
        const w = Store.getWidgets().find((x) => x.id === it.id);
        if (w) {
          w.x = it.x;
          w.y = it.y;
          w.w = it.w;
          w.h = it.h;
        }
      }
      Store.save();
    });
  }

  function render() {
    cleanup();
    mount();
  }

  function setEditing(v) {
    isEditing = v;
    render(); // 重建以显隐编辑条 / 启停拖拽
  }
  const isEdit = () => isEditing;

  // gridstack 自带响应式重排，无需手动；保留接口以兼容 app.js
  function relayout() {}

  function openSettings(w) {
    const def = Widgets.get(w.type);
    if (!def || !def.editor) return;
    Modal.open({
      title: def.name + " · 设置",
      onMount: (container) => def.editor(container, w),
    });
  }

  function api() {
    return {
      reload: render,
      save: () => Store.save(),
      openSettings,
    };
  }

  return { render, setEditing, isEdit, openSettings, relayout, findFreeSpot };
})();
