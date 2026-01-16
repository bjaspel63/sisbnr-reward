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

// ========================
// DOM
// ========================
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const classSelect = document.getElementById("classSelect");
const studentList = document.getElementById("studentList");
const overlay = document.getElementById("overlay");
const confetti = document.getElementById("confetti");
const spotName = document.getElementById("spotName");
const spotClass = document.getElementById("spotClass");
const spotAvatar = document.getElementById("spotAvatar");
const resetClassBtn = document.getElementById("resetClassBtn");
const toast = document.getElementById("toast");

// NEW: Teacher + Subject inputs (make sure these exist in HTML)
const teacherNameInput = document.getElementById("teacherName");
const subjectNameInput = document.getElementById("subjectName");

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
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);

  if (lines.length < 2) throw new Error("students.csv looks empty.");

  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const idx = {
    id: headers.indexOf("id"),
    name: headers.indexOf("name"),
    section: headers.indexOf("section")
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
  "🦄","🐯","🦊","🐼","🦖","🐙","🦋","🐵","🐸","🐰","🐨","🦁",
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
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 1600);
}

function burstConfetti(container, pieces = 140) {
  container.innerHTML = "";
  const colors = ["#ff4dd2", "#ffcc33", "#6a5cff", "#00d4ff", "#7CFF6B", "#ffffff"];
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("i");
    p.style.left = (Math.random() * 100) + "vw";
    p.style.top = (-20 - Math.random() * 40) + "px";
    p.style.animationDelay = (Math.random() * 0.25) + "s";
    p.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
    p.style.width = (7 + Math.random() * 10) + "px";
    p.style.height = (10 + Math.random() * 18) + "px";
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
  setTimeout(() => (container.innerHTML = ""), 2600);
}

function showSpotlight(className, student) {
  spotName.textContent = student.name.toUpperCase() + " 🎉";
  spotClass.textContent = className;
  spotAvatar.textContent = getAvatarFor(student, className);

  overlay.classList.add("show");
  burstConfetti(confetti, 160);
}

// close spotlight
overlay.addEventListener("click", () => overlay.classList.remove("show"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") overlay.classList.remove("show");
});

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
  studentList.innerHTML = "";
  document.querySelectorAll(".dropArea").forEach(a => (a.innerHTML = ""));

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
  document.querySelectorAll(".zone").forEach(zone => {
    const tier = zone.dataset.tier;
    const area = zone.querySelector(".dropArea");
    setupDropTarget(zone, tier, false);
    setupDropTarget(area, tier, false);
  });
}

function setupDropTarget(targetEl, toTier, isStudentList) {
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

    const student = students.find(s => s.id === sid);
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
    const dropArea = (toTier === "none")
      ? studentList
      : document.querySelector(`.dropArea[data-drop="${toTier}"]`);

    if (card && dropArea) dropArea.prepend(card);

    // Save tier
    setTier(className, sid, toTier);

    // Spotlight on Gold
    if (toTier === "gold") {
      showSpotlight(className, student);
    }
  });
}

// ========================
// PDF REPORT
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
  doc.text("SISB-NR Progress Report", 14, 18);

  doc.setFontSize(12);
  doc.text(`Section: ${className}`, 14, 28);
  doc.text(`Teacher: ${tName}`, 14, 36);
  doc.text(`Subject: ${sName}`, 14, 44);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 52);

  // Table header
  let y = 64;
  doc.setFontSize(11);
  doc.text("RN", 14, y);
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

  const fileName = `${safeFileName(className)}_${safeFileName(sName)}_Report.pdf`;
  doc.save(fileName);
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
    classSelect.innerHTML = classNames
      .map(c => `<option value="${c}">${c}</option>`)
      .join("");

    classSelect.value = classNames[0];

    // load meta into inputs (if present)
    const meta = loadMeta();
    if (teacherNameInput) teacherNameInput.value = meta.teacherName || "";
    if (subjectNameInput) subjectNameInput.value = meta.subjectName || "";

    // save meta while typing
    if (teacherNameInput) {
      teacherNameInput.addEventListener("input", () => {
        saveMeta({ teacherName: teacherNameInput.value, subjectName: subjectNameInput ? subjectNameInput.value : "" });
      });
    }
    if (subjectNameInput) {
      subjectNameInput.addEventListener("input", () => {
        saveMeta({ teacherName: teacherNameInput ? teacherNameInput.value : "", subjectName: subjectNameInput.value });
      });
    }

    // render first class
    renderClass(classSelect.value);

    // wire events
    classSelect.addEventListener("change", () => renderClass(classSelect.value));
    downloadPdfBtn.addEventListener("click", downloadSectionPDF);

    resetClassBtn.addEventListener("click", () => {
    const cls = classSelect.value;
  
    const ok = confirm(`Reset this class?\n\n${cls}\n\nThis will clear all Green/Bronze/Silver/Gold progress for this section on this device.`);
  
    if (!ok) return;
  
    clearClassProgress(cls);
    renderClass(cls);
    showToast("Class reset ✅");
  });


    setupDropZones();
  } catch (err) {
    console.error(err);
    alert("Error:\n" + err.message);
  }
}

init();
