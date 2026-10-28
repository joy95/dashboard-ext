/* 网格：渲染小组件、编辑态拖拽排序、尺寸调整、删除、设置 */
const Grid = (() => {
  let isEditing = false;

  function cleanup() {
    document
      .querySelectorAll("#grid .widget-content")
      .forEach((c) => c._cleanup && c._cleanup());
  }

  function render() {
    cleanup();
    const grid = document.getElementById("grid");
    grid.innerHTML = "";
    grid.classList.toggle("editing", isEditing);
    const widgets = Store.getWidgets();
    let dragId = null;

    widgets.forEach((w) => {
      const def = Widgets.get(w.type);
      if (!def) return;
      const cell = document.createElement("div");
      cell.className = "widget";
      cell.style.gridColumn = `span ${w.span[0]}`;
      cell.style.gridRow = `span ${w.span[1]}`;
      cell.dataset.id = w.id;

      if (isEditing) {
        cell.draggable = true;
        cell.innerHTML = `<div class="widget-edit-bar">
            <span class="drag-handle" title="拖拽排序">⠿</span>
            <span class="w-title">${def.icon} ${escapeHtml(w.title)}</span>
            <span class="w-actions">
              ${
                def.configurable
                  ? '<button data-act="settings" title="设置">⚙</button>'
                  : ""
              }
              <button data-act="size" title="尺寸">⤢</button>
              <button data-act="del" title="删除">🗑</button>
            </span>
          </div>`;
      }

      const content = document.createElement("div");
      content.className = "widget-content";
      cell.appendChild(content);
      try {
        def.render(content, w, api());
      } catch (e) {
        content.innerHTML = `<div class="empty-state">组件渲染失败：${escapeHtml(
          e.message
        )}</div>`;
      }
      grid.appendChild(cell);

      if (isEditing) {
        cell.addEventListener("dragstart", (e) => {
          dragId = w.id;
          e.dataTransfer.effectAllowed = "move";
        });
        cell.addEventListener("dragover", (e) => e.preventDefault());
        cell.addEventListener("drop", (e) => {
          e.preventDefault();
          const arr = Store.getWidgets();
          const from = arr.findIndex((x) => x.id === dragId);
          const to = arr.findIndex((x) => x.id === w.id);
          if (from < 0 || to < 0 || from === to) return;
          const [item] = arr.splice(from, 1);
          arr.splice(to, 0, item);
          Store.setWidgets(arr);
          Store.save();
          render();
        });
        cell.querySelector('[data-act="del"]').onclick = () => {
          if (!confirm(`删除「${w.title}」？`)) return;
          const arr = Store.getWidgets().filter((x) => x.id !== w.id);
          Store.setWidgets(arr);
          Store.save();
          render();
        };
        const sizeBtn = cell.querySelector('[data-act="size"]');
        if (sizeBtn)
          sizeBtn.onclick = (e) => openSizeMenu(e.currentTarget, w, def);
        const setBtn = cell.querySelector('[data-act="settings"]');
        if (setBtn) setBtn.onclick = () => openSettings(w);
      }
    });

    if (!widgets.length) {
      grid.innerHTML = `<div class="empty-state">还没有小组件，点右上角「＋ 添加小组件」开始吧。</div>`;
    }
  }

  function openSizeMenu(btn, w, def) {
    closeSizeMenu();
    const menu = document.createElement("div");
    menu.className = "size-menu";
    menu.id = "size-menu";
    def.sizes.forEach(([c, r]) => {
      const b = document.createElement("button");
      b.textContent = `${c}×${r}`;
      if (w.span[0] === c && w.span[1] === r) b.classList.add("active");
      b.onclick = () => {
        w.span = [c, r];
        Store.save();
        closeSizeMenu();
        render();
      };
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const rect = btn.getBoundingClientRect();
    menu.style.left = Math.max(8, rect.left) + "px";
    menu.style.top = rect.bottom + 6 + "px";
    setTimeout(
      () => document.addEventListener("click", closeSizeMenu, { once: true }),
      0
    );
  }
  function closeSizeMenu() {
    const m = document.getElementById("size-menu");
    if (m) m.remove();
  }

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

  function setEditing(v) {
    isEditing = v;
    render();
  }
  const isEdit = () => isEditing;
  const escapeHtml = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return { render, setEditing, isEdit, openSettings };
})();
