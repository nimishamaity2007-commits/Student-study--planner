const STORAGE_KEY = "studyspace_tasks_v1";
const STUDY_KEY = "studyspace_sessions_v1";
const $ = (id) => document.getElementById(id);
let tasks = load(STORAGE_KEY, []);
let sessions = load(STUDY_KEY, []);
let editingId = null;
let toastTimer;

function load(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; }
  catch { return fallback; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); localStorage.setItem(STUDY_KEY, JSON.stringify(sessions)); }
  catch { showToast("Could not save data in this browser."); }
}
function todayISO() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10);
}
function prettyDate(value) {
  if (!value) return "No date";
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {day:"numeric",month:"short",year:"numeric"});
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function isOverdue(task) { return !task.completed && task.deadline < todayISO(); }
function showToast(message) {
  $("toast").textContent = message; $("toast").classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}
function render() {
  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(isOverdue).length;
  $("total-count").textContent = tasks.length;
  $("completed-count").textContent = completed;
  $("pending-count").textContent = pending;
  $("overdue-count").textContent = overdue;
  const pct = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  $("progress-percent").textContent = pct + "%";
  $("progress-fraction").textContent = `${completed} of ${tasks.length}`;
  $("progress-ring").style.setProperty("--progress", (pct * 3.6) + "deg");
  $("progress-bar").style.width = pct + "%";

  const query = $("search-input").value.trim().toLowerCase();
  const filter = $("filter-select").value;
  const visible = tasks.filter(t => {
    const matchesQuery = [t.title,t.subject,t.type,t.priority].join(" ").toLowerCase().includes(query);
    const matchesFilter = filter === "all" || (filter === "pending" && !t.completed) ||
      (filter === "completed" && t.completed) || (filter === "overdue" && isOverdue(t));
    return matchesQuery && matchesFilter;
  }).sort((a,b) => Number(a.completed)-Number(b.completed) || a.deadline.localeCompare(b.deadline));
  $("task-list").innerHTML = visible.map(task => `
    <article class="task-item ${task.completed ? "done" : ""}">
      <input class="task-check" type="checkbox" aria-label="Mark ${escapeHTML(task.title)} completed" data-action="toggle" data-id="${task.id}" ${task.completed ? "checked" : ""}>
      <div class="task-main">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          <span>${escapeHTML(task.subject || "General")}</span><span>·</span>
          <span class="tag">${escapeHTML(task.type)}</span>
          <span class="tag priority-${task.priority}">${task.priority[0].toUpperCase()+task.priority.slice(1)} priority</span>
          <span class="${isOverdue(task) ? "deadline-overdue" : ""}">Due ${prettyDate(task.deadline)}${isOverdue(task) ? " · Overdue" : ""}</span>
        </div>
      </div>
      <div class="task-actions"><button class="icon-btn" title="Edit task" aria-label="Edit task" data-action="edit" data-id="${task.id}">✎</button><button class="icon-btn" title="Delete task" aria-label="Delete task" data-action="delete" data-id="${task.id}">×</button></div>
    </article>`).join("");
  $("empty-state").style.display = visible.length ? "none" : "block";
  $("task-list").style.display = visible.length ? "grid" : "none";
  renderSessions();
}
function openDialog(task = null) {
  editingId = task ? task.id : null;
  $("dialog-title").textContent = task ? "Edit task" : "Add a task";
  $("task-title").value = task?.title || "";
  $("task-subject").value = task?.subject || "";
  $("task-deadline").value = task?.deadline || todayISO();
  $("task-priority").value = task?.priority || "medium";
  $("task-type").value = task?.type || "Assignment";
  $("task-dialog").showModal();
  $("task-title").focus();
}
function closeDialog() { $("task-dialog").close(); }
$("task-form").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("task-title").value.trim();
  if (!title) return;
  const data = {title, subject:$("task-subject").value.trim(), deadline:$("task-deadline").value,
    priority:$("task-priority").value, type:$("task-type").value};
  if (!data.deadline) { showToast("Please choose a deadline."); return; }
  if (editingId) {
    const task = tasks.find(t => t.id === editingId);
    if (task) Object.assign(task, data);
    showToast("Task updated.");
  } else {
    tasks.push({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...data, completed:false, createdAt:Date.now()});
    showToast("Task added to your planner.");
  }
  save(); render(); closeDialog();
});
$("add-task-top").addEventListener("click", () => openDialog());
$("empty-add").addEventListener("click", () => openDialog());
$("close-dialog").addEventListener("click", closeDialog);
$("cancel-dialog").addEventListener("click", closeDialog);
$("search-input").addEventListener("input", render);
$("filter-select").addEventListener("change", render);
$("task-list").addEventListener("change", event => {
  const target = event.target;
  if (target.dataset.action === "toggle") {
    const task = tasks.find(t => t.id === target.dataset.id);
    if (task) { task.completed = target.checked; save(); render(); showToast(task.completed ? "Nice work — task completed!" : "Task marked as pending."); }
  }
});
$("task-list").addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = tasks.find(t => t.id === button.dataset.id);
  if (!task) return;
  if (button.dataset.action === "edit") openDialog(task);
  if (button.dataset.action === "delete" && confirm(`Delete "${task.title}"?`)) {
    tasks = tasks.filter(t => t.id !== task.id); save(); render(); showToast("Task deleted.");
  }
});
$("clear-completed").addEventListener("click", () => {
  const count = tasks.filter(t => t.completed).length;
  if (!count) { showToast("There are no completed tasks to clear."); return; }
  if (confirm(`Remove ${count} completed task(s)?`)) { tasks = tasks.filter(t => !t.completed); save(); render(); showToast("Completed tasks cleared."); }
});
function renderSessions() {
  sessions.sort((a,b) => a.date.localeCompare(b.date));
  $("study-list").innerHTML = sessions.length ? sessions.map(s => `
    <div class="study-session"><span class="session-dot"></span><div class="session-info"><strong>${escapeHTML(s.topic)}</strong><small>${prettyDate(s.date)} · ${escapeHTML(s.duration)}</small></div><button class="session-delete" data-session-delete="${s.id}" aria-label="Delete study session" title="Delete session">×</button></div>`).join("") : '<div class="study-empty">Your study sessions will appear here.</div>';
}
$("study-date").value = todayISO();
$("study-form").addEventListener("submit", event => {
  event.preventDefault();
  const topic = $("study-topic").value.trim(), date = $("study-date").value;
  if (!topic || !date) return;
  sessions.push({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), topic, date, duration:$("study-duration").value});
  $("study-topic").value = ""; save(); renderSessions(); showToast("Study session added.");
});
$("study-list").addEventListener("click", event => {
  const button = event.target.closest("[data-session-delete]");
  if (!button) return;
  sessions = sessions.filter(s => s.id !== button.dataset.sessionDelete); save(); renderSessions(); showToast("Study session removed.");
});
$("today-label").textContent = new Date().toLocaleDateString(undefined, {weekday:"long",month:"long",day:"numeric"}).toUpperCase();
render();
