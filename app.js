const grid = document.querySelector("#innovation-grid");
const emptyState = document.querySelector("#empty-state");
const loadError = document.querySelector("#load-error");
const searchInput = document.querySelector("#search-input");
const initiativeDialog = document.querySelector("#initiative-dialog");
const initiativeForm = document.querySelector("#initiative-form");
const formError = document.querySelector("#form-error");
const saveButton = document.querySelector("#save-button");
const toast = document.querySelector("#toast");

let initiatives = [];
let selectedStatus = "Semua";
let editingId = null;
let toastTimer;

const numberFormatter = new Intl.NumberFormat("id-ID");
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Permintaan gagal. Silakan coba lagi.");
  }
  return response.status === 204 ? null : response.json();
}

async function loadInitiatives() {
  loadError.hidden = true;
  try {
    initiatives = await apiRequest("/api/initiatives");
    render();
  } catch (error) {
    loadError.textContent = `${error.message} Pastikan DATABASE_URL sudah dikonfigurasi.`;
    loadError.hidden = false;
    updateMetrics([]);
  }
}

function updateMetrics(items) {
  const activeCount = items.filter((item) => item.status === "Berjalan").length;
  const impactCount = items.reduce((total, item) => total + Number(item.impact), 0);
  document.querySelector("#total-count").textContent = numberFormatter.format(items.length);
  document.querySelector("#active-count").textContent = numberFormatter.format(activeCount);
  document.querySelector("#impact-count").textContent = numberFormatter.format(impactCount);
  document.querySelector("#nav-count").textContent = numberFormatter.format(items.length);
  document.querySelector("#all-filter-count").textContent = numberFormatter.format(items.length);
}

function cardTemplate(item, index) {
  const safeId = escapeHTML(item.id);
  return `
    <article class="innovation-card" style="animation-delay:${index * 45}ms">
      <div class="card-top">
        <span class="category-tag" data-category="${escapeHTML(item.category)}">${escapeHTML(item.category)}</span>
        <div class="card-menu-wrap">
          <button class="card-menu-button" data-action="menu" data-id="${safeId}" aria-label="Menu ${escapeHTML(item.title)}">···</button>
          <div class="card-menu" id="menu-${safeId}">
            <button data-action="edit" data-id="${safeId}">✎ &nbsp; Edit inovasi</button>
            <button class="delete-action" data-action="delete" data-id="${safeId}">⌫ &nbsp; Hapus</button>
          </div>
        </div>
      </div>
      <h3 class="card-title">${escapeHTML(item.title)}</h3>
      <p class="card-description">${escapeHTML(item.description)}</p>
      <div class="card-footer">
        <div class="owner-info"><span class="owner-avatar">${escapeHTML(initials(item.owner))}</span><span class="owner-name">${escapeHTML(item.owner)}</span></div>
        <div class="card-meta">
          <span class="impact-meta"><span>◎</span>${numberFormatter.format(item.impact)}</span>
          <span class="status-badge" data-status="${escapeHTML(item.status)}">${escapeHTML(item.status)}</span>
        </div>
      </div>
    </article>`;
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("id");
  const filtered = initiatives.filter((item) => {
    const matchesStatus = selectedStatus === "Semua" || item.status === selectedStatus;
    const matchesQuery = [item.title, item.category, item.description, item.owner]
      .some((value) => value.toLocaleLowerCase("id").includes(query));
    return matchesStatus && matchesQuery;
  });
  grid.innerHTML = filtered.map(cardTemplate).join("");
  emptyState.hidden = filtered.length !== 0;
  updateMetrics(initiatives);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function openForm(initiative = null) {
  editingId = initiative?.id ?? null;
  formError.hidden = true;
  initiativeForm.reset();
  initiativeForm.elements.status.value = initiative?.status ?? "Ide";
  initiativeForm.elements.impact.value = initiative?.impact ?? 0;
  initiativeForm.elements.start_date.value = initiative?.start_date ?? new Date().toISOString().slice(0, 10);
  if (initiative) {
    for (const field of ["title", "category", "description", "owner"]) {
      initiativeForm.elements[field].value = initiative[field];
    }
  }
  document.querySelector("#form-title").textContent = initiative ? "Edit inovasi" : "Inovasi baru";
  saveButton.innerHTML = initiative ? "Simpan perubahan <span>↗</span>" : "Simpan inovasi <span>↗</span>";
  initiativeDialog.showModal();
}

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("id-ID", {
  weekday: "short", day: "numeric", month: "short", year: "numeric"
}).format(new Date());

document.querySelector("#add-button").addEventListener("click", () => openForm());
document.querySelector("#banner-add-button").addEventListener("click", () => openForm());
document.querySelector("#close-dialog").addEventListener("click", () => initiativeDialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => initiativeDialog.close());
searchInput.addEventListener("input", render);

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    selectedStatus = button.dataset.status;
    document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    render();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === "Escape" && !initiativeDialog.open) {
    document.querySelectorAll(".card-menu.open").forEach((menu) => menu.classList.remove("open"));
  }
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    if (!event.target.closest(".card-menu")) {
      document.querySelectorAll(".card-menu.open").forEach((menu) => menu.classList.remove("open"));
    }
    return;
  }
  const { action, id } = button.dataset;
  const initiative = initiatives.find((item) => item.id === id);
  if (action === "menu") {
    document.querySelectorAll(".card-menu.open").forEach((menu) => menu.classList.remove("open"));
    document.querySelector(`#menu-${CSS.escape(id)}`)?.classList.toggle("open");
  } else if (action === "edit" && initiative) {
    openForm(initiative);
  } else if (action === "delete" && initiative) {
    const confirmed = window.confirm(`Hapus "${initiative.title}" dari daftar inovasi?`);
    if (!confirmed) return;
    try {
      await apiRequest(`/api/initiatives/${encodeURIComponent(id)}`, { method: "DELETE" });
      initiatives = initiatives.filter((item) => item.id !== id);
      render();
      showToast("Inovasi berhasil dihapus.");
    } catch (error) {
      showToast(error.message);
    }
  }
});

initiativeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";
  const data = Object.fromEntries(new FormData(initiativeForm));
  data.impact = Number(data.impact);
  try {
    const url = editingId ? `/api/initiatives/${encodeURIComponent(editingId)}` : "/api/initiatives";
    const method = editingId ? "PUT" : "POST";
    const saved = await apiRequest(url, { method, body: JSON.stringify(data) });
    if (editingId) {
      initiatives = initiatives.map((item) => item.id === editingId ? saved : item);
    } else {
      initiatives.unshift(saved);
    }
    initiativeDialog.close();
    render();
    showToast(editingId ? "Perubahan inovasi berhasil disimpan." : "Inovasi baru berhasil ditambahkan.");
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = editingId ? "Simpan perubahan <span>↗</span>" : "Simpan inovasi <span>↗</span>";
  }
});

loadInitiatives();
