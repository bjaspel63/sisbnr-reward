// ========================
// DATA (loaded from CSV)
// ========================
let CLASSES = {}; // will be filled by loadStudentsCSV()

// Progress ladder (no list tier)
const ORDER = ["none", "green", "bronze", "silver", "gold"];

// Storage key per class
const KEY_PREFIX = "ladder_tiers_class_v1::";

// Meta storage (teacher + subject)
const META_KEY = "ladder_meta_v1";

// Weekly spotlight log storage
const SPOTLIGHT_LOG_KEY = "spotlight_log_v1";

// ========================
// DOM
// ========================
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const weeklyPosterBtn = document.getElementById("weeklyPosterBtn");
const clearWeeklyBtn = document.getElementById("clearWeeklyBtn");

const weeklyListEl = document.getElementById("weeklyList");
const weeklyRangeEl = document.getElementById("weeklyRange");

const classSelect = document.getElementById("classSelect");
const studentList = document.getElementById("studentList");
const overlay = document.getElementById("overlay");
const confetti = document.getElementById("confetti");
const spotName = document.getElementById("spotName");
const spotClass = document.getElementById("spotClass");
const spotAvatar = document.getElementById("spotAvatar");
const resetClassBtn = document.getElementById("resetClassBtn");
const toast = document.getElementById("toast");

// Teacher + Subject inputs
const teacherNameInput = document.getElementById("teacherName");
const subjectNameInput = document.getElementById("subjectName");

const spotSound = document.getElementById("spotSound");

// Unlock audio on first user interaction
document.addEventListener(
  "click",
  () => {
    if (spotSound) {
      spotSound
        .play()
        .then(() => {
          spotSound.pause();
          spotSound.currentTime = 0;
        })
        .catch(() => {});
    }
  },
  { once: true }
);

// ========================
// CSV LOADER
// ========================
function splitCSVLine(line) {
  // Handles commas inside quotes: "Last, First"
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // toggle quotes or escaped quote
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

async function loadStudentsCSV() {
  const res = await fetch("students.csv", { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load students.csv (make sure it's in the same folder).");

  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);

  if (lines.length < 2) throw new Error("students.csv looks empty.");

  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  const idx = {
    id: headers.indexOf("id"),
    name: headers.indexOf("name"),
    section: headers.indexOf("section"),
  };

  if (idx.id === -1 || idx.name === -1 || idx.section === -1) {
    throw new Error("CSV must have headers: id,name,section");
  }

  const classes = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);

    const id = (cols[idx.id] || "").trim();
    const name = (cols[idx.name] || "").trim();
    const section = (cols[idx.section] || "").trim();

    if (!id || !name || !section) continue;

    if (!classes[section]) classes[section] = [];
    classes[section].push({ id, name }); // emoji assigned later
  }

  // sort names per class (optional)
  for (const sec of Object.keys(classes)) {
    classes[sec].sort((a, b) => a.name.localeCompare(b.name));
  }

  return classes;
}

// ========================
// AVATAR (random but stable)
// ========================
const EMOJIS = [
  "🐮","🐯","🦊","🐼","🦖","🐙","🦋","🐵","🐸","🐰","🐨","🦁",
  "🐶","🐱","🐹","🐧","🦉","🐝","🐢","🐬","🦩","🦓","🐠","🦒",
  "🐞","🦕","🐙","🦝","🐻","🐔","🐦","🦜"
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function getAvatarFor(student, className) {
  // stable per student + class
  const key = `${student.id}|${student.name}|${className}`.toLowerCase();
  return EMOJIS[hashString(key) % EMOJIS.length];
}

// ========================
// STORAGE (tiers)
// ========================
function loadTierMap(className) {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + className) || "{}");
  } catch {
    return {};
  }
}

function saveTierMap(className, map) {
  localStorage.setItem(KEY_PREFIX + className, JSON.stringify(map));
}

function getTier(className, studentId) {
  const map = loadTierMap(className);
  return map[studentId] || "none";
}

function setTier(className, studentId, tier) {
  const map = loadTierMap(className);
  map[studentId] = tier;
  saveTierMap(className, map);
}

function clearClassProgress(className) {
  localStorage.removeItem(KEY_PREFIX + className);
}

// ========================
// STORAGE (teacher + subject)
// ========================
function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

// ========================
// STORAGE (weekly spotlight log)
// ========================
function loadSpotlightLog() {
  try {
    return JSON.parse(localStorage.getItem(SPOTLIGHT_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSpotlightLog(list) {
  localStorage.setItem(SPOTLIGHT_LOG_KEY, JSON.stringify(list));
}

// Week starts on Monday (local time)
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function weekKey(d = new Date()) {
  const s = startOfWeek(d);
  return s.toISOString().slice(0, 10); // YYYY-MM-DD (Monday)
}

function formatDate(d) {
  return d.toLocaleDateString();
}

function inThisWeek(ts) {
  const s = startOfWeek(new Date());
  const e = endOfWeek(new Date());
  return ts >= s.getTime() && ts <= e.getTime();
}

// ========================
// HELPERS
// ========================
function tierIndex(t) {
  return ORDER.indexOf(t);
}

function nextTier(fromTier) {
  const i = tierIndex(fromTier);
  return ORDER[i + 1] || null;
}

// forward only: must go to the next step exactly
function canMoveForward(fromTier, toTier) {
  return toTier === nextTier(fromTier);
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
}

function burstConfetti(container, pieces = 140) {
  if (!container) return;
  container.innerHTML = "";
  const colors = ["#ff4dd2", "#ffcc33", "#6a5cff", "#00d4ff", "#7CFF6B", "#ffffff"];
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw";
    p.style.top = -20 - Math.random() * 40 + "px";
    p.style.animationDelay = Math.random() * 0.25 + "s";
    p.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    p.style.width = 7 + Math.random() * 10 + "px";
    p.style.height = 10 + Math.random() * 18 + "px";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
  setTimeout(() => (container.innerHTML = ""), 2600);
}

function showSpotlight(className, student) {
  if (!overlay) return;

  spotName.textContent = student.name.toUpperCase() + " 🎉";
  spotClass.textContent = className;
  spotAvatar.textContent = getAvatarFor(student, className);

  overlay.classList.add("show");
  burstConfetti(confetti, 160);

  if (spotSound) {
    spotSound.currentTime = 0;
    spotSound.play().catch(() => {
      console.log("Sound blocked by browser until user interaction.");
    });
  }
}

// close spotlight
if (overlay) {
  overlay.addEventListener("click", () => overlay.classList.remove("show"));
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay) overlay.classList.remove("show");
});

// ========================
// WEEKLY SUMMARY (UI + LOGIC)
// ========================
function logGoldSpotlight(className, student) {
  const wk = weekKey(new Date());
  const log = loadSpotlightLog();

  // avoid duplicates: same student + same section, same week
  const exists = log.some(
    (x) => x.week === wk && x.studentId === student.id && x.section === className
  );
  if (exists) return;

  log.push({
    week: wk,
    t: Date.now(),
    studentId: student.id,
    name: student.name,
    section: className,
  });

  saveSpotlightLog(log);
}

function getThisWeekEntries() {
  return loadSpotlightLog()
    .filter((x) => inThisWeek(x.t))
    .sort((a, b) => a.t - b.t);
}

function renderWeeklySummary() {
  if (!weeklyListEl || !weeklyRangeEl) return;

  const s = startOfWeek(new Date());
  const e = endOfWeek(new Date());
  weeklyRangeEl.textContent = `${formatDate(s)} – ${formatDate(e)}`;

  const entries = getThisWeekEntries();

  if (!entries.length) {
    weeklyListEl.innerHTML = `<div class="weeklyEmpty">No Gold Spotlights yet this week 🌈</div>`;
    return;
  }

  weeklyListEl.innerHTML = entries
    .map(
      (x, i) => `
      <div class="weeklyItem">
        <div class="weeklyNum">${i + 1}</div>
        <div class="weeklyInfo">
          <div class="weeklyName">${x.name}</div>
          <div class="weeklySub">Section: <b>${x.section}</b></div>
        </div>
        <div class="weeklyStar">🌟</div>
      </div>
    `
    )
    .join("");
}

// ========================
// RENDER
// ========================
function makeStudentCard(student, className) {
  const card = document.createElement("div");
  card.className = "student";
  card.draggable = true;
  card.dataset.sid = student.id;

  const emoji = getAvatarFor(student, className);

  card.innerHTML = `
    <div class="left">
      <div class="avatar">${emoji}</div>
      <div>
        <div class="name">${student.name}</div>
        <div class="sub">${className}</div>
      </div>
    </div>
  `;

  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", student.id);
    e.dataTransfer.effectAllowed = "move";
  });

  return card;
}

function renderClass(className) {
  // clear all areas
  if (studentList) studentList.innerHTML = "";
  document.querySelectorAll(".dropArea").forEach((a) => (a.innerHTML = ""));

  const students = CLASSES[className] || [];

  // place students: either in Student List (none) OR in tier drop areas
  for (const s of students) {
    const tier = getTier(className, s.id);
    const card = makeStudentCard(s, className);

    if (tier === "none") {
      studentList.appendChild(card);
    } else {
      const area = document.querySelector(`.dropArea[data-drop="${tier}"]`);
      (area || studentList).appendChild(card);
    }
  }
}

// ========================
// DROP ZONES
// ========================
function setupDropZones() {
  // Student list acts as "none" drop target
  setupDropTarget(studentList, "none", true);

  // Tiers
  document.querySelectorAll(".zone").forEach((zone) => {
    const tier = zone.dataset.tier;
    const area = zone.querySelector(".dropArea");
    setupDropTarget(zone, tier, false);
    setupDropTarget(area, tier, false);
  });
}

function setupDropTarget(targetEl, toTier, isStudentList) {
  if (!targetEl) return;

  const highlightZone = isStudentList
    ? null
    : targetEl.classList.contains("zone")
      ? targetEl
      : targetEl.closest(".zone");

  targetEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (highlightZone) highlightZone.classList.add("dragover");
  });

  targetEl.addEventListener("dragleave", () => {
    if (highlightZone) highlightZone.classList.remove("dragover");
  });

  targetEl.addEventListener("drop", (e) => {
    e.preventDefault();
    if (highlightZone) highlightZone.classList.remove("dragover");

    const className = classSelect.value;
    const students = CLASSES[className] || [];

    const sid = e.dataTransfer.getData("text/plain");
    if (!sid) return;

    const student = students.find((s) => s.id === sid);
    if (!student) return;

    const fromTier = getTier(className, sid);

    // Forward-only rule (next step exactly)
    if (toTier === "none") {
      if (fromTier !== "none") {
        showToast("Forward only! 🙂 (No going back)");
        return;
      }
    } else {
      if (!canMoveForward(fromTier, toTier)) {
        const expected = nextTier(fromTier);
        showToast(`Next step: ${expected ? expected.toUpperCase() : "DONE!"}`);
        return;
      }
    }

    // Move the card (no duplicates)
    const card = document.querySelector(`.student[data-sid="${sid}"]`);
    const dropArea =
      toTier === "none"
        ? studentList
        : document.querySelector(`.dropArea[data-drop="${toTier}"]`);

    if (card && dropArea) dropArea.prepend(card);

    // Save tier
    setTier(className, sid, toTier);

    // Spotlight on Gold + weekly log
    if (toTier === "gold") {
      showSpotlight(className, student);
      logGoldSpotlight(className, student);
      renderWeeklySummary();
    }
  });
}

// ========================
// PDF REPORT (SECTION)
// ========================
function safeFileName(str) {
  return String(str || "")
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "_");
}

function downloadSectionPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library (jsPDF) not loaded. Check the jsPDF script tag in index.html.");
    return;
  }

  const className = classSelect.value;
  const students = CLASSES[className] || [];
  const tierMap = loadTierMap(className);

  const teacherName = teacherNameInput ? (teacherNameInput.value || "").trim() : "";
  const subjectName = subjectNameInput ? (subjectNameInput.value || "").trim() : "";
  const tName = teacherName || "—";
  const sName = subjectName || "—";

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.text("SISB-NR Positive Behavior Report", 14, 18);

  doc.setFontSize(12);
  doc.text(`Section: ${className}`, 14, 28);
  doc.text(`Teacher: ${tName}`, 14, 36);
  doc.text(`Subject: ${sName}`, 14, 44);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 52);

  let y = 64;

  // Table header
  doc.setFontSize(11);
  doc.text("No.", 14, y);
  doc.text("Student Name", 30, y);
  doc.text("Level", 150, y);

  y += 6;
  doc.line(14, y, 195, y);
  y += 8;

  // Rows
  students.forEach((s, i) => {
    const level = (tierMap[s.id] || "none").toUpperCase();

    doc.text(String(i + 1), 14, y);
    doc.text(s.name, 30, y);
    doc.text(level, 150, y);

    y += 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  // Summary
  y += 10;
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  const counts = { none: 0, green: 0, bronze: 0, silver: 0, gold: 0 };
  students.forEach((s) => {
    const t = tierMap[s.id] || "none";
    counts[t] = (counts[t] || 0) + 1;
  });

  doc.setFontSize(13);
  doc.text("Progress Summary", 14, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Total Students: ${students.length}`, 14, y); y += 8;
  doc.text(`Green   : ${counts.green}`, 14, y); y += 8;
  doc.text(`Bronze  : ${counts.bronze}`, 14, y); y += 8;
  doc.text(`Silver  : ${counts.silver}`, 14, y); y += 8;
  doc.text(`Gold    : ${counts.gold}`, 14, y); y += 10;

  y += 24;

  // Note section
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.text("Note:", 14, y);
  y += 6;

  doc.setFontSize(10);
  const noteText =
    "This Positive Behavior Report shows each student's current achievement level based on classroom participation, performance, and behavior. " +
    "Students progress through Green, Bronze, Silver, and Gold levels. Gold level represents outstanding achievement and excellence. " +
    "This is a system generated report.";

  const wrappedNote = doc.splitTextToSize(noteText, 180);
  doc.text(wrappedNote, 14, y);

  const fileName = `${safeFileName(className)}_${safeFileName(sName)}_Report.pdf`;
  doc.save(fileName);
}

// ========================
// PDF REPORT (WEEKLY POSTER)
// ========================
function downloadWeeklySpotlightPosterPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library (jsPDF) not loaded.");
    return;
  }

  const entries = getThisWeekEntries();
  const s = startOfWeek(new Date());
  const e = endOfWeek(new Date());

  const teacherName = teacherNameInput ? (teacherNameInput.value || "").trim() : "";
  const subjectName = subjectNameInput ? (subjectNameInput.value || "").trim() : "";

  const tName = teacherName || "—";
  const subName = subjectName || "—";

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210, H = 297;

  // Use built-in safe font only (no emoji support)
  doc.setFont("helvetica", "normal");

  // ---- helpers ----
  const clampText = (str, max) => {
    const s = String(str || "");
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  };

  const formatRange = () => `${formatDate(s)} – ${formatDate(e)}`;

  // Confetti colors (bright, kid-friendly)
  const CONF_COLORS = [
    [255, 77, 210],   // pink
    [255, 204, 51],   // yellow
    [106, 92, 255],   // purple
    [0, 212, 255],    // cyan
    [124, 255, 107],  // green
    [255, 120, 0],    // orange
  ];

  function drawConfetti(count = 220) {
    for (let i = 0; i < count; i++) {
      const c = CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)];
      doc.setFillColor(c[0], c[1], c[2]);

      const x = Math.random() * W;
      const y = Math.random() * H;

      if (Math.random() < 0.55) {
        doc.circle(x, y, 0.8 + Math.random() * 1.2, "F");
      } else {
        const rw = 1.2 + Math.random() * 2.5;
        const rh = 2.2 + Math.random() * 4.5;
        doc.rect(x, y, rw, rh, "F");
      }
    }
  }

  function drawBackground() {
    doc.setFillColor(245, 250, 255);
    doc.rect(0, 0, W, H, "F");

    const bands = [
      [255, 232, 252],
      [235, 248, 255],
      [235, 255, 239],
      [255, 250, 230],
      [240, 238, 255],
    ];

    let y = 0;
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      doc.setFillColor(b[0], b[1], b[2]);
      doc.rect(0, y, W, 70, "F");
      y += 50;
    }

    drawConfetti(240);
  }

  function drawHeader() {
    doc.setFillColor(106, 92, 255);
    doc.roundedRect(8, 8, 194, 28, 6, 6, "F");

    doc.setFillColor(0, 212, 255);
    doc.roundedRect(18, 32, 174, 10, 6, 6, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("WEEKLY SPOTLIGHT", W / 2, 26, { align: "center" });

    doc.setFontSize(11);
    doc.text("SISB-NR Positive Behavior Rewards", W / 2, 39, { align: "center" });

    // ✅ moved LOWER (was 54)
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(12);
    doc.text(`Week: ${formatRange()}`, W / 2, 58, { align: "center" });
  }

  function drawMainCard() {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 62, 190, 205, 10, 10, "F");

    doc.setDrawColor(225);
    doc.roundedRect(10, 62, 190, 205, 10, 10, "S");
  }

  function drawFooter() {
    doc.setFillColor(255, 204, 51);
    doc.roundedRect(8, 274, 194, 15, 6, 6, "F");

    doc.setFillColor(255, 77, 210);
    doc.circle(18, 281.5, 3.0, "F");
    doc.setFillColor(0, 212, 255);
    doc.circle(28, 281.5, 2.2, "F");
    doc.setFillColor(124, 255, 107);
    doc.circle(38, 281.5, 2.6, "F");

    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Amazing work! Keep shining bright!", W / 2, 286, { align: "center" });

    // ✅ moved UP (was 289)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(
      `Teacher: ${clampText(tName, 30)}  •  Subject: ${clampText(subName, 20)}`,
      W / 2,
      286,
      { align: "center" }
    );
  }

  function drawList() {
    let y = 78;

    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Gold Spotlight Students", W / 2, y, { align: "center" });
    y += 10;

    if (!entries.length) {
      doc.setFontSize(16);
      doc.text("No Gold Spotlights yet this week.", W / 2, 150, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(80);
      doc.text("Try your best and be kind!", W / 2, 162, { align: "center" });
      return;
    }

    doc.setFillColor(245, 250, 255);
    doc.roundedRect(18, y - 6, 174, 10, 4, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(60);
    doc.text("No.", 22, y);
    doc.text("Student Name", 38, y);
    doc.text("Section", 160, y);

    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    entries.forEach((x, i) => {
      if (y > 255) {
        doc.addPage();
        drawBackground();
        drawHeader();
        drawMainCard();
        drawFooter();

        y = 78;
        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Gold Spotlight Students", W / 2, y, { align: "center" });
        y += 10;

        doc.setFillColor(245, 250, 255);
        doc.roundedRect(18, y - 6, 174, 10, 4, 4, "F");
        doc.setFontSize(11);
        doc.setTextColor(60);
        doc.text("No.", 22, y);
        doc.text("Student Name", 38, y);
        doc.text("Section", 160, y);

        y += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
      }

      const alt = i % 2 === 1;
      doc.setFillColor(alt ? 255 : 250, alt ? 245 : 255, alt ? 255 : 245);
      doc.roundedRect(18, y - 6, 174, 11, 5, 5, "F");

      doc.setTextColor(255, 77, 210);
      doc.setFont("helvetica", "bold");
      doc.text("*", 20, y);

      doc.setTextColor(17, 24, 39);
      doc.setFont("helvetica", "normal");
      doc.text(String(i + 1), 24, y);
      doc.text(clampText(x.name, 32), 38, y);
      doc.text(clampText(x.section, 14), 160, y);

      y += 13;
    });
  }

  drawBackground();
  drawHeader();
  drawMainCard();
  drawList();
  drawFooter();

  doc.save(`Weekly_Spotlight_${weekKey(new Date())}.pdf`);
}


// ========================
// INIT
// ========================
async function init() {
  try {
    // Load students from CSV
    CLASSES = await loadStudentsCSV();

    const classNames = Object.keys(CLASSES);
    if (!classNames.length) throw new Error("No classes found in students.csv");

    // populate class dropdown
    classSelect.innerHTML = classNames.map((c) => `<option value="${c}">${c}</option>`).join("");
    classSelect.value = classNames[0];

    // load meta into inputs (if present)
    const meta = loadMeta();
    if (teacherNameInput) teacherNameInput.value = meta.teacherName || "";
    if (subjectNameInput) subjectNameInput.value = meta.subjectName || "";

    // save meta while typing
    if (teacherNameInput) {
      teacherNameInput.addEventListener("input", () => {
        saveMeta({
          teacherName: teacherNameInput.value,
          subjectName: subjectNameInput ? subjectNameInput.value : "",
        });
      });
    }
    if (subjectNameInput) {
      subjectNameInput.addEventListener("input", () => {
        saveMeta({
          teacherName: teacherNameInput ? teacherNameInput.value : "",
          subjectName: subjectNameInput.value,
        });
      });
    }

    // render first class
    renderClass(classSelect.value);

    // weekly UI
    renderWeeklySummary();

    // wire events
    classSelect.addEventListener("change", () => renderClass(classSelect.value));

    if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", downloadSectionPDF);
    if (weeklyPosterBtn) weeklyPosterBtn.addEventListener("click", downloadWeeklySpotlightPosterPDF);

    if (clearWeeklyBtn) {
      clearWeeklyBtn.addEventListener("click", () => {
        const ok = confirm("Clear ONLY this week's spotlight list on this device?");
        if (!ok) return;

        const wk = weekKey(new Date());
        const log = loadSpotlightLog().filter((x) => x.week !== wk);
        saveSpotlightLog(log);

        renderWeeklySummary();
        showToast("Weekly list cleared ✅");
      });
    }

    if (resetClassBtn) {
      resetClassBtn.addEventListener("click", () => {
        const cls = classSelect.value;

        const ok = confirm(
          `Reset this class?\n\n${cls}\n\nThis will clear all Green/Bronze/Silver/Gold progress for this section on this device.`
        );
        if (!ok) return;

        clearClassProgress(cls);
        renderClass(cls);
        showToast("Class reset ✅");
      });
    }

    setupDropZones();
  } catch (err) {
    console.error(err);
    alert("Error:\n" + err.message);
  }
}

init();
