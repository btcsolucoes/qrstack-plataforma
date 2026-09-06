let workspaceInsightView = "overview";
let workspaceClientView = "formulario";

function uiIcon(name, className = "") {
  return `<img class="ui-icon ${className}" src="assets/icons/${name}.svg" alt="" aria-hidden="true" width="20" height="20" />`;
}

function workspaceBrand(href = "#/home") {
  return `<a class="workspace-brand" href="${href}" aria-label="QrStack, início"><img src="${ASSETS.qrstackMark}" alt="" /><span>QrStack<small>WORKSPACE</small></span></a>`;
}

function renderWorkspace({ active = "overview", title, subtitle = "", content, restaurant = getRestaurant(ACTIVE_CLIENT_SLUG), client = false, actions = "" }) {
  const owner = hasRememberedAccess(OWNER_SESSION_KEY);
  const links = client ? [
    ["formulario", "Cardápio do dia", "utensils", ""],
    ["catalog-manager", "Meus pratos", "layers", ""],
    ...(STORY_AUTOMATION_ENABLED ? [["story-panel", "Story", "smartphone", ""]] : []),
    ["public", "Cardápio público", "external-link", publicMenuHash(restaurant, "cliente")],
  ] : [
    ["overview", "Visão geral", "house", ownerLink("overview")],
    ["insights", "Insights", "chart-no-axes-combined", ownerLink("insights")],
    ["clientes", "Restaurantes", "store", ownerLink("clientes")],
    ["banco", "Pratos e marca", "utensils", ownerLink("banco")],
    ["respostas", "Respostas", "inbox", ownerLink("respostas")],
    ["cardapios", "Cardápios e links", "link", ownerLink("cardapios")],
    ...(STORY_AUTOMATION_ENABLED ? [["stories", "Stories", "smartphone", ownerLink("stories")]] : []),
  ];
  const navItem = ([id, label, icon, href], mobile = false) => {
    const attrs = href ? `href="${href}"` : `type="button" data-client-view="${id}"`;
    const tag = href ? "a" : "button";
    const shortLabel = mobile ? ({ overview: "Início", banco: "Pratos", formulario: "Hoje", "catalog-manager": "Pratos", public: "Cardápio" }[id] || label) : label;
    return `<${tag} ${attrs} class="workspace-nav-item ${id === active ? "active" : ""}" ${id === active ? 'aria-current="page"' : ""}>${uiIcon(icon)}<span>${shortLabel}</span>${!mobile && id === "respostas" ? '<i class="nav-marker"></i>' : ""}</${tag}>`;
  };
  const mobileLinks = client ? links : links.filter(([id]) => ["overview", "insights", "banco", "respostas"].includes(id));
  const date = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date());
  return `
    <div class="workspace ${client ? "workspace--client" : ""}">
      <a class="skip-link" href="#workspace-main">Ir para o conteúdo</a>
      <button class="nav-scrim" data-close-nav aria-label="Fechar navegação" tabindex="-1"></button>
      <aside class="workspace-sidebar" id="workspace-navigation" aria-label="Navegação principal">
        <div class="sidebar-brand-row">${workspaceBrand(client ? clientPortalLink(restaurant) : ownerLink())}<button type="button" class="icon-button sidebar-close" data-close-nav aria-label="Fechar navegação">${uiIcon("x")}</button></div>
        <div class="workspace-context"><span class="context-avatar">${client ? "A" : "Q"}</span><div><strong>${client ? restaurant.name : "Central QrStack"}</strong><small>${client ? "Portal do restaurante" : "Seu espaço de gestão"}</small></div></div>
        <p class="sidebar-label">${client ? "Restaurante" : "Workspace"}</p>
        <nav class="workspace-nav">${links.map((link) => navItem(link)).join("")}</nav>
        <div class="sidebar-bottom">
          <a class="workspace-nav-item" href="${client && owner ? ownerLink() : "#/home"}">${uiIcon(client && owner ? "arrow-left" : "layers")}<span>${client && owner ? "Voltar à central" : "Trocar acesso"}</span></a>
          <div class="sidebar-account"><span class="account-avatar">${client ? "A" : "Q"}</span><div><strong>${client ? restaurant.name : "Administração"}</strong><small>${client ? "Restaurante" : "QrStack"}</small></div><span class="account-dot" title="Sessão aberta"></span></div>
        </div>
      </aside>
      <div class="workspace-stage">
        <header class="workspace-topbar">
          <div class="breadcrumb"><span>${client ? "Restaurante" : "Workspace"}</span>${uiIcon("chevron-right")}<strong>${title}</strong></div>
          <div class="topbar-context"><span class="topbar-date">${uiIcon("calendar-days")}${date}</span><span class="account-avatar">${client ? "A" : "Q"}</span></div>
        </header>
        <main class="workspace-main" id="workspace-main" tabindex="-1">
          <div class="workspace-page-heading"><div><p class="eyebrow">${client ? escapeHtml(restaurant.name) : "Central de operações"}</p><h1>${title}</h1>${subtitle ? `<p class="muted">${subtitle}</p>` : ""}</div>${actions ? `<div class="actions">${actions}</div>` : ""}</div>
          ${content}
          <footer class="workspace-footer"><span>QrStack</span><span>${client ? "Seu cardápio, sempre presente." : "Uma visão mais clara do seu negócio."}</span></footer>
        </main>
      </div>
      <nav class="mobile-navigation" aria-label="Navegação principal mobile">
        ${mobileLinks.map((link) => navItem(link, true)).join("")}
        <button type="button" class="workspace-nav-item ${!client && ["clientes", "cardapios", "stories"].includes(active) ? "active" : ""}" data-open-nav aria-controls="workspace-navigation" aria-expanded="false">${uiIcon("menu")}<span>Mais</span></button>
      </nav>
    </div>`;
}

function renderWorkspaceLoading(label) {
  return `<div class="workspace-loading" role="status"><span class="loading-spinner"></span><p>${label}</p></div><div class="skeleton-grid" aria-hidden="true">${"<div></div>".repeat(4)}</div>`;
}

function renderWorkspaceOverview() {
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  return `
    <section class="overview-intro"><div><span class="live-label"><i></i> Seu workspace</span><h2>Tudo no lugar.<br>Negócio em movimento.</h2><p>Cardápios, clientes e resultados, em uma só visão.</p><a class="button" href="${ownerLink("insights")}">Explorar Insights ${uiIcon("arrow-up-right")}</a></div><img class="overview-brand-art" src="${ASSETS.qrstackMark}" alt="Símbolo QrStack em metal" /></section>
    <div class="section-title-row"><h2>Visão do negócio</h2><span>${escapeHtml(restaurant.name)} <span class="separator">/</span> Histórico completo</span></div>
    <div id="overview-live">${renderWorkspaceLoading("Buscando a última leitura analítica...")}</div>
    <div class="overview-lower">
      <section class="restaurant-overview"><div class="section-title-row"><h2>Seus restaurantes</h2><a class="text-link" href="${ownerLink("clientes")}">Ver todos ${uiIcon("arrow-right")}</a></div>${renderRestaurantRow(restaurant)}</section>
      <section class="quick-actions"><div class="section-title-row"><h2>Na sua rotina</h2></div><a href="${clientPortalLink(restaurant)}">${uiIcon("utensils")}<span><strong>Publicar cardápio do dia</strong><small>${escapeHtml(restaurant.name)}</small></span>${uiIcon("arrow-up-right")}</a><a href="${ownerLink("respostas")}">${uiIcon("inbox")}<span><strong>Consultar respostas</strong><small>Plataforma e Google Forms</small></span>${uiIcon("arrow-up-right")}</a><a href="${ownerLink("banco")}">${uiIcon("layers")}<span><strong>Gerenciar pratos e marca</strong><small>Catálogo do restaurante</small></span>${uiIcon("arrow-up-right")}</a></section>
    </div>`;
}

async function hydrateWorkspaceOverview() {
  const target = document.getElementById("overview-live");
  if (!target) return;
  try {
    const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
    const data = await endpointGet(restaurant.analyticsEndpoint || QRSTACK_API_URL, "getInsights", { slug: restaurant.slug, key: OWNER_ACCESS_TOKEN });
    if (!target.isConnected) return;
    const stats = data.insights || {};
    target.innerHTML = `<div class="kpi-strip">${workspaceKpi("Acessos ao cardápio", stats.total_accesses ?? stats.total_page_views, "Histórico completo", "scan-line")}${workspaceKpi("Visitantes únicos", stats.unique_visitors_total, "Identidades rastreáveis", "users")}${workspaceKpi("Visitantes recorrentes", stats.returning_visitors_total, "Duas ou mais sessões", "refresh-cw")}${workspaceKpi("Instagram → Direto", stats.instagram_to_direct?.instagram_to_direct_visitors, "Identidades que retornaram", "arrow-up-right")}</div><div class="data-footnote">${uiIcon("activity")}Leitura ${stats.collected_at ? formatDateTime(stats.collected_at) : "recebida da base"}<span>${data.analytics_storage?.ingestion_status === "fallback_active" ? "Contingência ativa" : data.analytics_storage?.dashboard_status === "cached_snapshot" ? "Consolidado salvo" : "Base analítica"}</span></div>`;
  } catch {
    if (target.isConnected) target.innerHTML = `<div class="empty-state">${uiIcon("activity")}<div><strong>A leitura está indisponível no momento</strong><p>Abra os Insights para consultar a última leitura disponível e tentar atualizar.</p></div><a class="button secondary" href="${ownerLink("insights")}">Abrir Insights</a></div>`;
  }
}

function workspaceKpi(label, value, detail, icon = "activity", accent = false) {
  return `<article class="workspace-kpi ${accent ? "workspace-kpi--accent" : ""}"><div><span>${label}</span>${uiIcon(icon)}</div><strong>${value === undefined || value === null ? "—" : formatNumber(value)}</strong><small>${detail}</small></article>`;
}

function renderRestaurantRow(restaurant) {
  return `<article class="restaurant-row"><div class="restaurant-logo"><img src="${restaurant.originalLogoUrl || restaurant.logoUrl}" alt="${escapeAttr(restaurant.name)}" /></div><div class="restaurant-row__copy"><span class="eyebrow">Restaurante</span><h3>${escapeHtml(restaurant.name)}</h3><p>${escapeHtml(restaurant.address || "")}</p></div><div class="restaurant-row__actions"><a class="button secondary" href="${clientPortalLink(restaurant)}">Gerenciar ${uiIcon("arrow-up-right")}</a><a class="text-link" href="${publicMenuHash(restaurant, "hq")}">Ver cardápio ${uiIcon("external-link")}</a></div></article>`;
}

function renderWorkspaceCatalog() {
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  const catalog = getCatalogForRestaurant(restaurant).filter(isCatalogItemActive);
  const categories = [...new Set(catalog.map((item) => item.section_title || item.category || "Outros"))];
  return `<section class="catalog-workspace"><div class="catalog-toolbar"><label class="search-field">${uiIcon("search")}<input type="search" data-workspace-search aria-label="Buscar prato" placeholder="Buscar um prato..." /></label><select data-workspace-category aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("")}</select><a class="button" href="${clientPortalLink(restaurant)}&view=catalog-manager">${uiIcon("plus")}Adicionar prato</a></div><div class="catalog-meta"><span data-catalog-count>${catalog.length} pratos</span><span>${escapeHtml(restaurant.name)}</span></div><div class="workspace-dish-grid">${catalog.map((item) => {
    const category = item.section_title || item.category || "Outros";
    const photo = item.image_url ? catalogImageUrl(item.image_url, restaurant) : "";
    return `<article class="workspace-dish" data-workspace-dish data-search="${escapeAttr(normalizeKey(item.name + " " + category))}" data-category="${escapeAttr(category)}"><div class="workspace-dish__photo">${photo ? `<img src="${escapeAttr(photo)}" alt="${escapeAttr(item.name)}" loading="lazy" />` : `<span>${uiIcon("utensils")}<small>Sem foto</small></span>`}</div><div class="workspace-dish__body"><span class="eyebrow">${escapeHtml(category)}</span><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description || "Sem descrição cadastrada.")}</p><div><strong>${escapeHtml(item.price || "Preço não informado")}</strong><a class="icon-button" href="${clientPortalLink(restaurant)}&view=catalog-manager&dish=${encodeURIComponent(item.id)}" title="Editar ${escapeAttr(item.name)}" aria-label="Editar ${escapeAttr(item.name)}">${uiIcon("pencil")}</a></div></div></article>`;
  }).join("")}</div><div class="empty-state" data-catalog-empty hidden>Nenhum prato encontrado nesta busca.</div><details class="brand-details"><summary>${uiIcon("layers")}Identidade do restaurante ${uiIcon("chevron-down")}</summary><div class="brand-details__content"><img src="${restaurant.originalLogoUrl || restaurant.logoUrl}" alt="Logo original ${escapeAttr(restaurant.name)}" /><div><h3>${escapeHtml(restaurant.name)}</h3><div class="palette"><span style="background:${restaurant.primaryColor}" title="${restaurant.primaryColor}"></span><span style="background:${restaurant.secondaryColor}" title="${restaurant.secondaryColor}"></span></div><a class="text-link" href="${restaurantOriginalMenuUrl(restaurant)}" target="_blank" rel="noreferrer">Cardápio original ${uiIcon("external-link")}</a></div></div></details></section>`;
}

async function hydrateWorkspaceCatalog() {
  const target = document.querySelector(".catalog-workspace");
  if (!target) return;
  await syncCatalogForRestaurant(getRestaurant(ACTIVE_CLIENT_SLUG));
  if (!target.isConnected) return;
  const search = target.querySelector("[data-workspace-search]")?.value || "";
  const category = target.querySelector("[data-workspace-category]")?.value || "";
  target.outerHTML = renderWorkspaceCatalog();
  document.querySelector("[data-workspace-search]").value = search;
  document.querySelector("[data-workspace-category]").value = category;
  filterWorkspaceCatalog();
}

function filterWorkspaceCatalog() {
  const query = normalizeKey(document.querySelector("[data-workspace-search]")?.value || "");
  const category = document.querySelector("[data-workspace-category]")?.value || "";
  let count = 0;
  document.querySelectorAll("[data-workspace-dish]").forEach((dish) => {
    dish.hidden = !dish.dataset.search.includes(query) || Boolean(category && dish.dataset.category !== category);
    if (!dish.hidden) count++;
  });
  const counter = document.querySelector("[data-catalog-count]");
  if (counter) counter.textContent = `${count} ${count === 1 ? "prato" : "pratos"}`;
  const empty = document.querySelector("[data-catalog-empty]");
  if (empty) empty.hidden = count > 0;
}

function renderWorkspaceLinks() {
  const restaurant = getRestaurant(ACTIVE_CLIENT_SLUG);
  const links = [["Cardápio público", "external-link", restaurantOriginalMenuUrl(restaurant, "platform")], ["Instagram", "smartphone", restaurantOriginalMenuUrl(restaurant, "instagram")], ["WhatsApp", "link", restaurantOriginalMenuUrl(restaurant, "whatsapp")], ["QR Code", "scan-line", restaurantOriginalMenuUrl(restaurant, "qr")], ["Acesso do restaurante", "store", restaurantAccessUrl(restaurant)]];
  return `<section>${renderRestaurantRow(restaurant)}<div class="section-title-row"><h2>Links do restaurante</h2><span>${escapeHtml(restaurant.name)}</span></div><div class="workspace-link-list">${links.map(([label, icon, url]) => `<div class="workspace-link-row">${uiIcon(icon)}<div><strong>${label}</strong><span>${escapeHtml(url)}</span></div><button class="icon-button" type="button" data-copy="${escapeAttr(url)}" aria-label="Copiar ${label}" title="Copiar ${label}">${uiIcon("copy")}</button><a class="icon-button" href="${escapeAttr(url)}" target="_blank" rel="noreferrer" title="Abrir ${label}" aria-label="Abrir ${label}">${uiIcon("arrow-up-right")}</a></div>`).join("")}</div><p class="data-footnote">${uiIcon("circle-help")}A origem só é identificada por QR quando o link contém a marcação de QR Code.</p></section>`;
}

function setWorkspaceInsightsView(view = workspaceInsightView) {
  workspaceInsightView = ["overview", "audience", "dishes", "technical"].includes(view) ? view : "overview";
  document.querySelectorAll("[data-insight-view]").forEach((button) => {
    const active = button.dataset.insightView === workspaceInsightView;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll("[data-insight-panel]").forEach((panel) => { panel.hidden = panel.dataset.insightPanel !== workspaceInsightView; });
}

function setWorkspaceClientView(view) {
  const target = document.getElementById(view);
  if (!target?.classList.contains("client-step")) return;
  workspaceClientView = view;
  document.querySelectorAll(".client-step").forEach((panel) => { panel.hidden = panel.id !== view; });
  document.querySelectorAll("[data-client-view]").forEach((button) => {
    const active = button.dataset.clientView === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const title = { formulario: "Cardápio do dia", "catalog-manager": "Meus pratos", "story-panel": "Story" }[view];
  document.querySelector(".workspace-page-heading h1").textContent = title;
  document.querySelector(".breadcrumb strong").textContent = title;
  closeWorkspaceNav();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function closeWorkspaceNav() {
  document.body.classList.remove("navigation-open");
  document.querySelector("[data-open-nav]")?.setAttribute("aria-expanded", "false");
  if (document.querySelector(".workspace-sidebar")?.contains(document.activeElement) && matchMedia("(max-width: 1000px)").matches) document.querySelector("[data-open-nav]")?.focus();
}

document.addEventListener("click", (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    document.getElementById("workspace-main")?.focus();
  }
  if (event.target.closest("[data-catalog-create]")) {
    document.getElementById("catalog-item-form").reset();
    document.getElementById("catalog-dialog-title").textContent = "Novo prato";
    document.getElementById("catalog-dialog").showModal();
    document.getElementById("catalog-name").focus();
  }
  if (event.target.closest("[data-close-catalog]")) document.getElementById("catalog-dialog")?.close();
  const view = event.target.closest("[data-insight-view]");
  if (view) setWorkspaceInsightsView(view.dataset.insightView);
  const clientView = event.target.closest("[data-client-view]");
  if (clientView) setWorkspaceClientView(clientView.dataset.clientView);
  if (event.target.closest("[data-open-nav]")) {
    document.body.classList.add("navigation-open");
    document.querySelector("[data-open-nav]").setAttribute("aria-expanded", "true");
    document.querySelector(".sidebar-close")?.focus();
  }
  if (event.target.closest("[data-close-nav]")) closeWorkspaceNav();
});
document.addEventListener("input", (event) => { if (event.target.matches("[data-workspace-search]")) filterWorkspaceCatalog(); });
document.addEventListener("change", (event) => { if (event.target.matches("[data-workspace-category]")) filterWorkspaceCatalog(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeWorkspaceNav();
  if (document.body.classList.contains("navigation-open") && event.key === "Tab") {
    const nodes = [...document.querySelectorAll(".workspace-sidebar a, .workspace-sidebar button")].filter((node) => node.offsetParent !== null);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const tab = event.target.closest("[data-insight-view]");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll("[data-insight-view]")];
  const index = tabs.indexOf(tab);
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  setWorkspaceInsightsView(tabs[next].dataset.insightView);
  tabs[next].focus();
});
