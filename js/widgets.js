/* 小组件注册表：每种类型含渲染与（可选的）配置编辑器 */
const Widgets = (() => {
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const uid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    "w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  // 强制刷新 iframe：切换 src 并附带 cache-bust，确保真实重新加载
  function reloadFrame(iframe, url) {
    if (!iframe || !url) return;
    try {
      const sep = url.includes("?") ? "&" : "?";
      iframe.src = url + sep + "_rf=" + Date.now();
    } catch (e) {
      iframe.src = url;
    }
  }

  // ---- 各类型定义 ----
  const TYPES = {
    clock: {
      type: "clock",
      name: "时钟",
      icon: "🕒",
      desc: "实时时间与日期",
      defaultSpan: [2, 1],
      sizes: [[2, 1], [2, 2], [3, 2]],
      configurable: false,
      createConfig: () => ({}),
      render(el, w) {
        el.innerHTML = `<div class="clock">
          <div class="clock-time" data-t>--:--:--</div>
          <div class="clock-date" data-d></div>
        </div>`;
        const t = el.querySelector("[data-t]");
        const d = el.querySelector("[data-d]");
        const tick = () => {
          const n = new Date();
          t.textContent = n.toLocaleTimeString("zh-CN", { hour12: false });
          d.textContent = n.toLocaleDateString("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          });
        };
        tick();
        const id = setInterval(tick, 1000);
        el._cleanup = () => clearInterval(id);
      },
    },

    calendar: {
      type: "calendar",
      name: "日历",
      icon: "📅",
      desc: "当月日历，高亮今天",
      defaultSpan: [3, 3],
      sizes: [[3, 3], [4, 3], [3, 4], [4, 4]],
      configurable: false,
      createConfig: () => ({}),
      render(el, w) {
        let view = new Date();
        const draw = () => {
          const y = view.getFullYear();
          const m = view.getMonth();
          const first = new Date(y, m, 1);
          const startDow = first.getDay();
          const days = new Date(y, m + 1, 0).getDate();
          const today = new Date();
          const isSame =
            today.getFullYear() === y && today.getMonth() === m;
          let cells = "";
          const dows = ["日", "一", "二", "三", "四", "五", "六"];
          for (const dw of dows)
            cells += `<div class="cal-dow">${dw}</div>`;
          for (let i = 0; i < startDow; i++)
            cells += `<div class="cal-cell muted"></div>`;
          for (let d = 1; d <= days; d++) {
            const cls =
              "cal-cell" +
              (isSame && d === today.getDate() ? " today" : "");
            cells += `<div class="${cls}">${d}</div>`;
          }
          el.innerHTML = `<div class="cal-head">
              <button data-prev>‹</button>
              <span class="cal-title">${y}年 ${m + 1}月</span>
              <button data-next>›</button>
            </div>
            <div class="cal-grid">${cells}</div>`;
          el.querySelector("[data-prev]").onclick = () => {
            view = new Date(y, m - 1, 1);
            draw();
          };
          el.querySelector("[data-next]").onclick = () => {
            view = new Date(y, m + 1, 1);
            draw();
          };
        };
        draw();
      },
    },

    todo: {
      type: "todo",
      name: "待办清单",
      icon: "✅",
      desc: "本地待办，可勾选/增删",
      defaultSpan: [2, 2],
      sizes: [[2, 2], [3, 2], [2, 3], [3, 3]],
      configurable: false,
      createConfig: () => ({ items: [] }),
      render(el, w) {
        w.config.items = w.config.items || [];
        const draw = () => {
          let lis = "";
          for (const it of w.config.items) {
            lis += `<li class="${it.done ? "done" : ""}">
              <input type="checkbox" data-id="${it.id}" ${it.done ? "checked" : ""}/>
              <span class="t-text">${esc(it.text)}</span>
              <button class="t-del" data-del="${it.id}" title="删除">×</button>
            </li>`;
          }
          el.innerHTML = `<div class="todo-head">待办清单</div>
            <div class="todo-add">
              <input data-new placeholder="添加一项…" />
              <button class="btn" data-add>添加</button>
            </div>
            <ul class="todo-list">${lis || '<div class="hint">暂无待办</div>'}</ul>`;
          const input = el.querySelector("[data-new]");
          const add = () => {
            const v = input.value.trim();
            if (!v) return;
            w.config.items.push({ id: uid(), text: v, done: false });
            Store.save();
            draw();
          };
          el.querySelector("[data-add]").onclick = add;
          input.onkeydown = (e) => {
            if (e.key === "Enter") add();
          };
          el.querySelectorAll("input[type=checkbox]").forEach((c) => {
            c.onchange = () => {
              const it = w.config.items.find((x) => x.id === c.dataset.id);
              if (it) it.done = c.checked;
              Store.save();
              draw();
            };
          });
          el.querySelectorAll("[data-del]").forEach((b) => {
            b.onclick = () => {
              w.config.items = w.config.items.filter(
                (x) => x.id !== b.dataset.del
              );
              Store.save();
              draw();
            };
          });
        };
        draw();
      },
    },

    notes: {
      type: "notes",
      name: "随手记",
      icon: "📝",
      desc: "便利贴式笔记，自动保存",
      defaultSpan: [2, 2],
      sizes: [[2, 2], [3, 2], [2, 3], [4, 3]],
      configurable: false,
      createConfig: () => ({ text: "" }),
      render(el, w) {
        el.innerHTML = `<div class="notes-head">随手记</div>
          <textarea class="notes-area" placeholder="写点什么…">${esc(
            w.config.text || ""
          )}</textarea>`;
        const ta = el.querySelector(".notes-area");
        let timer = null;
        ta.oninput = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            w.config.text = ta.value;
            Store.save();
          }, 600);
        };
      },
    },

    links: {
      type: "links",
      name: "常用链接",
      icon: "🔗",
      desc: "常用网站快捷入口",
      defaultSpan: [2, 2],
      sizes: [[2, 2], [3, 2], [4, 2], [3, 3]],
      configurable: true,
      createConfig: () => ({
        links: [
          { title: "百度", url: "https://www.baidu.com", icon: "🔍" },
          { title: "GitHub", url: "https://github.com", icon: "🐙" },
        ],
      }),
      render(el, w) {
        w.config.links = w.config.links || [];
        if (!w.config.links.length) {
          el.innerHTML = `<div class="links-grid"><div class="link-tile empty" data-edit>＋ 添加链接</div></div>`;
          el.querySelector("[data-edit]").onclick = () =>
            Grid.openSettings(w);
          return;
        }
        let tiles = "";
        for (const l of w.config.links) {
          tiles += `<a class="link-tile" data-url="${esc(l.url)}" title="${esc(
            l.title
          )}">
            <span class="li-emoji">${esc(l.icon || "🔗")}</span>
            <span class="li-title">${esc(l.title)}</span>
          </a>`;
        }
        el.innerHTML = `<div class="links-grid">${tiles}</div>`;
        el.querySelectorAll(".link-tile").forEach((a) => {
          a.onclick = (e) => {
            e.preventDefault();
            window.open(a.dataset.url, "_blank", "noopener");
          };
        });
      },
      editor(container, w) {
        const links = w.config.links || [];
        const rowHtml = (l, i) => `
          <div class="row-link" data-i="${i}">
            <input class="li-emoji-in" data-k="icon" value="${esc(l.icon || "")}" placeholder="🙂" maxlength="2"/>
            <input data-k="title" value="${esc(l.title || "")}" placeholder="名称"/>
            <input data-k="url" value="${esc(l.url || "")}" placeholder="https://"/>
            <button class="rm" data-rm="${i}" title="删除">×</button>
          </div>`;
        container.innerHTML = `<div class="field"><label>链接列表</label>
          <div id="links-rows">${links.map(rowHtml).join("")}</div>
          <button class="btn" id="add-link" style="margin-top:8px">＋ 添加一行</button>
          <div class="hint">点击图标可填 emoji；保存后点击磁贴在新标签打开。</div>
        </div>
        <div class="modal-foot">
          <button class="btn" data-cancel>取消</button>
          <button class="btn btn-primary" data-save>保存</button>
        </div>`;
        const rowsEl = container.querySelector("#links-rows");
        const read = () => {
          const out = [];
          rowsEl.querySelectorAll(".row-link").forEach((r) => {
            const k = {};
            r.querySelectorAll("[data-k]").forEach(
              (inp) => (k[inp.dataset.k] = inp.value.trim())
            );
            if (k.url) out.push(k);
          });
          return out;
        };
        container.querySelector("#add-link").onclick = () => {
          const div = document.createElement("div");
          div.innerHTML = rowHtml({ icon: "", title: "", url: "" }, "__new__");
          rowsEl.appendChild(div.firstElementChild);
        };
        rowsEl.onclick = (e) => {
          if (e.target.dataset.rm != null) {
            e.target.closest(".row-link").remove();
          }
        };
        container.querySelector("[data-cancel]").onclick = () => Modal.close();
        container.querySelector("[data-save]").onclick = () => {
          w.config.links = read();
          Store.save();
          Modal.close();
          Grid.render();
        };
      },
    },

    website: {
      type: "website",
      name: "自定义网站",
      icon: "🌐",
      desc: "内嵌任意网站，支持自动刷新",
      defaultSpan: [4, 3],
      sizes: [[3, 3], [4, 3], [4, 4], [6, 4], [6, 5], [12, 5]],
      configurable: true,
      createConfig: () => ({ title: "我的网站", url: "", refresh: 0 }),
      render(el, w) {
        const cfg = w.config;
        el.innerHTML = `<div class="site-widget">
          <div class="site-bar">
            <span class="s-title">${esc(cfg.title || "网站")}</span>
            <button data-refresh title="刷新">⟳</button>
            <button data-open title="新标签打开">↗</button>
          </div>
          <iframe class="site-frame" ${
            cfg.url ? `src="${esc(cfg.url)}"` : ""
          }></iframe>
        </div>`;
        const frame = el.querySelector(".site-frame");
        if (!cfg.url) {
          frame.remove();
          const body = el.querySelector(".site-widget");
          body.insertAdjacentHTML(
            "beforeend",
            `<div class="empty-state">未设置网址<br/>点击「编辑」填写网址</div>`
          );
          return;
        }
        el.querySelector("[data-refresh]").onclick = () =>
          reloadFrame(frame, cfg.url);
        el.querySelector("[data-open]").onclick = () =>
          window.open(cfg.url, "_blank", "noopener");
        if (cfg.refresh && Number(cfg.refresh) > 0) {
          const ms = Number(cfg.refresh) * 1000;
          const id = setInterval(() => reloadFrame(frame, cfg.url), ms);
          el._cleanup = () => clearInterval(id);
        }
      },
      editor(container, w) {
        const cfg = w.config;
        const opt = (v, label) =>
          `<option value="${v}" ${
            String(cfg.refresh) === String(v) ? "selected" : ""
          }>${label}</option>`;
        container.innerHTML = `<div class="field">
            <label>标题</label>
            <input data-k="title" value="${esc(cfg.title || "")}" placeholder="显示名称"/>
          </div>
          <div class="field">
            <label>网站地址 (URL)</label>
            <input data-k="url" value="${esc(cfg.url || "")}" placeholder="https://example.com"/>
            <div class="hint">部分网站禁止被内嵌（X-Frame-Options），此时请用「↗」在新标签打开。</div>
          </div>
          <div class="field">
            <label>自动刷新间隔</label>
            <select data-k="refresh">
              ${opt(0, "关闭")}
              ${opt(30, "30 秒")}
              ${opt(60, "1 分钟")}
              ${opt(300, "5 分钟")}
              ${opt(900, "15 分钟")}
              ${opt(1800, "30 分钟")}
            </select>
          </div>
          <div class="modal-foot">
            <button class="btn" data-cancel>取消</button>
            <button class="btn btn-primary" data-save>保存</button>
          </div>`;
        container.querySelector("[data-cancel]").onclick = () => Modal.close();
        container.querySelector("[data-save]").onclick = () => {
          const k = {};
          container.querySelectorAll("[data-k]").forEach((inp) => {
            k[inp.dataset.k] = inp.value;
          });
          w.config.title = k.title || "网站";
          w.config.url = k.url.trim();
          w.config.refresh = Number(k.refresh) || 0;
          Store.save();
          Modal.close();
          Grid.render();
        };
      },
    },

    countdown: {
      type: "countdown",
      name: "倒计时",
      icon: "⏳",
      desc: "指向某个目标的倒计时",
      defaultSpan: [2, 1],
      sizes: [[2, 1], [3, 1], [2, 2]],
      configurable: true,
      createConfig: () => ({
        label: "目标日",
        target: new Date(Date.now() + 7 * 864e5).toISOString(),
      }),
      render(el, w) {
        const cfg = w.config;
        el.innerHTML = `<div class="cd-body">
          <div class="cd-label">${esc(cfg.label || "倒计时")}</div>
          <div class="cd-time" data-cd></div>
        </div>`;
        const out = el.querySelector("[data-cd]");
        const tick = () => {
          const diff = new Date(cfg.target).getTime() - Date.now();
          if (diff <= 0) {
            out.textContent = "已到达 🎉";
            out.classList.add("cd-done");
            return;
          }
          const d = Math.floor(diff / 864e5);
          const h = Math.floor((diff % 864e5) / 36e5);
          const m = Math.floor((diff % 36e5) / 6e4);
          const s = Math.floor((diff % 6e4) / 1000);
          out.textContent = `${d}天 ${String(h).padStart(2, "0")}:${String(
            m
          ).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        };
        tick();
        const id = setInterval(tick, 1000);
        el._cleanup = () => clearInterval(id);
      },
      editor(container, w) {
        const cfg = w.config;
        const toLocal = (iso) => {
          if (!iso) return "";
          const dt = new Date(iso);
          const pad = (n) => String(n).padStart(2, "0");
          return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
            dt.getDate()
          )}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        };
        container.innerHTML = `<div class="field">
            <label>标签</label>
            <input data-k="label" value="${esc(cfg.label || "")}" placeholder="例如：项目上线"/>
          </div>
          <div class="field">
            <label>目标时间</label>
            <input type="datetime-local" data-k="target" value="${toLocal(
              cfg.target
            )}"/>
          </div>
          <div class="modal-foot">
            <button class="btn" data-cancel>取消</button>
            <button class="btn btn-primary" data-save>保存</button>
          </div>`;
        container.querySelector("[data-cancel]").onclick = () => Modal.close();
        container.querySelector("[data-save]").onclick = () => {
          const k = {};
          container.querySelectorAll("[data-k]").forEach(
            (inp) => (k[inp.dataset.k] = inp.value)
          );
          w.config.label = k.label || "倒计时";
          w.config.target = k.target
            ? new Date(k.target).toISOString()
            : new Date().toISOString();
          Store.save();
          Modal.close();
          Grid.render();
        };
      },
    },
  };

  const list = () =>
    Object.values(TYPES).map((t) => ({
      type: t.type,
      name: t.name,
      icon: t.icon,
      desc: t.desc,
      configurable: t.configurable,
    }));

  const get = (type) => TYPES[type];

  function create(type, overrides = {}) {
    const def = TYPES[type];
    if (!def) throw new Error("unknown widget type: " + type);
    return {
      id: uid(),
      type,
      title: overrides.title || def.name,
      span: overrides.span ? overrides.span.slice() : def.defaultSpan.slice(),
      config: Object.assign(def.createConfig(), overrides.config || {}),
    };
  }

  return { TYPES, list, get, create };
})();
