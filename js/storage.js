/* 存储层：封装 chrome.storage.local，提供默认合并与便捷读写 */
const Store = (() => {
  const KEY = "dashboard.state.v1";
  const DEFAULT_SETTINGS = {
    theme: "olive-dark",
    autoRefresh: { enabled: false, interval: 30 }, // 整页自动刷新（分钟），默认关闭
  };

  let state = null;

  const clone = (o) => JSON.parse(JSON.stringify(o));

  function mergeSettings(base, over) {
    const out = clone(base);
    if (over && typeof over === "object") {
      for (const k in over) {
        if (
          over[k] &&
          typeof over[k] === "object" &&
          !Array.isArray(over[k]) &&
          base[k]
        ) {
          out[k] = mergeSettings(base[k], over[k]);
        } else {
          out[k] = over[k];
        }
      }
    }
    return out;
  }

  async function load() {
    const res = await chrome.storage.local.get(KEY);
    const saved = res[KEY] || {};
    state = {
      widgets: Array.isArray(saved.widgets) ? saved.widgets : null,
      settings: mergeSettings(DEFAULT_SETTINGS, saved.settings || {}),
    };
    return state;
  }

  async function save() {
    if (!state) return;
    await chrome.storage.local.set({
      [KEY]: { widgets: state.widgets, settings: state.settings },
    });
  }

  const get = () => state;
  const getWidgets = () => state.widgets || [];
  const setWidgets = (arr) => (state.widgets = arr);
  const getSettings = () => state.settings;
  const setSettings = (patch) =>
    (state.settings = Object.assign({}, state.settings, patch));
  const findWidget = (id) => (state.widgets || []).find((w) => w.id === id);
  const updateWidget = (id, patch) => {
    const w = findWidget(id);
    if (w) Object.assign(w, patch);
    return w;
  };

  return {
    load,
    save,
    get,
    getWidgets,
    setWidgets,
    getSettings,
    setSettings,
    findWidget,
    updateWidget,
  };
})();
