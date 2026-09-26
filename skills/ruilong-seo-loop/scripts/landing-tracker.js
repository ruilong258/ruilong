/*
 * 首次落地页追踪（第 3 步的数据来源）
 *
 * 作用：记住访客「第一次从搜索进站时落在哪一页」，在他提交询价 / 点 WhatsApp / 点微信时，
 * 把这个落地页一起发给 GA4 和你的询价表单。这样就能回答：哪篇文章真的带来了客户？
 *
 * 安装：放在网站所有页面的 </body> 前（WordPress 可用 WPCode 之类的插件插入），
 * 并确保 GA4 (gtag.js) 已安装。然后在 GA4 里把事件 generate_lead 标记为「关键事件」。
 */
(function () {
  var KEY = "rl_first_landing";
  var store;
  try { store = window.localStorage; } catch (e) { store = null; }

  function read() {
    try { return JSON.parse(store && store.getItem(KEY)); } catch (e) { return null; }
  }

  var first = read();
  if (!first) {
    first = {
      page: location.pathname,
      referrer: document.referrer ? new URL(document.referrer).hostname : "(direct)",
      ts: new Date().toISOString(),
    };
    try { store && store.setItem(KEY, JSON.stringify(first)); } catch (e) {}
  }

  function lead(method) {
    if (typeof window.gtag === "function") {
      window.gtag("event", "generate_lead", {
        method: method,
        first_landing_page: first.page,
        first_referrer: first.referrer,
      });
    }
  }

  // 1) 表单：自动塞一个隐藏字段，询价邮件里也能看到客户是从哪篇文章来的
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.querySelector('input[name="first_landing_page"]')) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "first_landing_page";
      input.value = first.page + " (from " + first.referrer + ")";
      form.appendChild(input);
    }
    lead("form");
  }, true);

  // 2) 点击 WhatsApp / 电话 / 邮件 / 微信 按钮也算一次询价
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a, [data-lead]");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/wa\.me|whatsapp/i.test(href)) lead("whatsapp");
    else if (/^tel:/i.test(href)) lead("phone");
    else if (/^mailto:/i.test(href)) lead("email");
    else if (a.hasAttribute("data-lead")) lead(a.getAttribute("data-lead") || "wechat");
  }, true);
})();
