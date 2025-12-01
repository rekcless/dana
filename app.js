import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

/* ----- Elemen ----- */
const form = document.getElementById("formPengeluaran");
const tanggalInput = document.getElementById("tanggal");
const jenisInput = document.getElementById("jenis");
const nominalInput = document.getElementById("nominal");
const keteranganInput = document.getElementById("keterangan");

const tabelHarian = document.querySelector("#tabelHarian tbody");
const tabelBulanan = document.querySelector("#tabelBulanan tbody");

const totalSaldoEl = document.getElementById("totalSaldo");
const rekapHarianEl = document.getElementById("rekapHarian");
const rekapBulananEl = document.getElementById("rekapBulanan");

const bulanTahunInput = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");
const filterJenis = document.getElementById("filterJenis");
const exportCSVBtn = document.getElementById("exportCSV");

let allData = [];
let chartInstance = null;

/* ===== Helpers ===== */
function parseDateSafe(t) {
  // Return Date object or null
  if (!t && t !== "") return null;

  // Firestore Timestamp-like (has toDate)
  if (t && typeof t.toDate === "function") {
    try {
      const d = t.toDate();
      return d instanceof Date && !isNaN(d) ? d : null;
    } catch (e) {
      return null;
    }
  }

  // If already Date
  if (t instanceof Date) {
    return isNaN(t) ? null : t;
  }

  // If string "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"
  if (typeof t === "string") {
    // If string contains date pattern YYYY-MM-DD
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      const dt = new Date(y, mo, d);
      return isNaN(dt) ? null : dt;
    }
    // Last resort: try Date constructor
    const dt2 = new Date(t);
    return isNaN(dt2) ? null : dt2;
  }

  return null;
}

function toNumber(v) {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const digits = v.replace(/[^\d\-]/g, "");
    const n = Number(digits);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}
function formatRp(n) {
  return "Rp" + Number(n).toLocaleString("id-ID");
}

/* ===== Nominal input formatting ===== */
nominalInput.addEventListener("input", (e) => {
  const raw = e.target.value.replace(/[^\d]/g, "");
  e.target.value = raw ? Number(raw).toLocaleString("id-ID") : "";
});

/* ===== Submit ===== */
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const tanggalRaw = tanggalInput.value; // expected "YYYY-MM-DD"
  const jenis = jenisInput.value;
  const nominal = toNumber(nominalInput.value);
  const keterangan = keteranganInput.value || "-";

  if (!tanggalRaw || !nominal) return alert("Isi tanggal dan nominal!");

  // Normalize and validate date
  const tanggalObj = parseDateSafe(tanggalRaw);
  if (!tanggalObj) {
    // As fallback, try today
    alert("Format tanggal tidak valid. Gunakan format tanggal di picker.");
    return;
  }

  // Prepare month & year helpers (numbers)
  const tahun = tanggalObj.getFullYear();
  const bulan = tanggalObj.getMonth() + 1; // 1..12
  const bulanStr = String(bulan).padStart(2, "0");
  const tanggalString = `${tahun}-${bulanStr}-${String(tanggalObj.getDate()).padStart(2, "0")}`;

  try {
    // Save tanggal as STRING "YYYY-MM-DD" to avoid TZ issues
    await addDoc(collection(db, "pengeluaran"), {
      tanggal: tanggalString,
      jenis,
      nominal,
      keterangan,
      tahun,
      bulan // numeric bulan memudahkan query/filter (opsional)
    });
    form.reset();
    await loadData();
  } catch (err) {
    console.error("Gagal menyimpan data:", err);
    alert("Gagal simpan data. Cek console untuk detail.");
  }
});

/* ===== Load Data ===== */
async function loadData() {
  try {
    const snap = await getDocs(collection(db, "pengeluaran"));
    allData = snap.docs.map(d => {
      const data = d.data();
      const parsed = parseDateSafe(data.tanggal);

      // If parse failed but there is year+bulan fields, try to build
      let tanggalFinal = parsed;
      if (!tanggalFinal && data.tahun && data.bulan) {
        const y = Number(data.tahun);
        const mo = Number(data.bulan) - 1;
        tanggalFinal = new Date(y, mo, 1);
      }

      // If still invalid, skip the entry by returning null marker; later filter it out
      return {
        id: d.id,
        tanggal: tanggalFinal, // may be null
        tanggalRaw: data.tanggal, // original value for CSV/diagnostics
        jenis: data.jenis || "pengeluaran",
        nominal: toNumber(data.nominal),
        keterangan: data.keterangan || "-"
      };
    }).filter(item => item !== null); // drop nulls just in case

    // Sort: place items with valid date first (desc), invalid at end
    allData.sort((a, b) => {
      if (!a.tanggal && !b.tanggal) return 0;
      if (!a.tanggal) return 1;
      if (!b.tanggal) return -1;
      return b.tanggal - a.tanggal;
    });

    updateHarian();
    updateBulanan();
    updateSaldo();
  } catch (err) {
    console.error("Gagal load data:", err);
    alert("Gagal mengambil data. Cek console untuk detail.");
  }
}

/* ===== Hapus Data ===== */
async function hapusData(id) {
  const pin = prompt("Masukkan PIN untuk hapus data:");
  if (pin !== "223344") return alert("PIN salah!");
  if (!confirm("Yakin mau hapus data ini?")) return;
  try {
    await deleteDoc(doc(db, "pengeluaran", id));
    await loadData();
  } catch (err) {
    console.error("Gagal hapus:", err);
    alert("Gagal hapus data. Cek console.");
  }
}
window.hapusData = hapusData;

/* ===== Update Harian ===== */
function updateHarian() {
  // compare by YYYY-MM-DD (string) to avoid TZ issues
  const todayIso = new Date();
  const todayStr = `${todayIso.getFullYear()}-${String(todayIso.getMonth()+1).padStart(2,'0')}-${String(todayIso.getDate()).padStart(2,'0')}`;

  const selectedFilter = filterJenis.value;
  let masuk = 0, keluar = 0;
  tabelHarian.innerHTML = "";

  allData.forEach(d => {
    if (!d.tanggal) return; // skip invalids
    const dStr = `${d.tanggal.getFullYear()}-${String(d.tanggal.getMonth()+1).padStart(2,'0')}-${String(d.tanggal.getDate()).padStart(2,'0')}`;
    if (dStr !== todayStr) return;
    if (selectedFilter !== "all" && d.jenis !== selectedFilter) return;

    const jenisClass = d.jenis === "pemasukan" ? "jenis-pemasukan" : "jenis-pengeluaran";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${d.tanggal.toLocaleDateString("id-ID")}</td>
      <td class="${jenisClass}">${d.jenis}</td>
      <td>${formatRp(d.nominal)}</td>
      <td>${d.keterangan}</td>
      <td><button class="delete-btn">Hapus</button></td>
    `;
    row.querySelector("button").addEventListener("click", () => hapusData(d.id));
    tabelHarian.appendChild(row);

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;
  });

  rekapHarianEl.innerHTML = `
    <p class="masuk-text">Total Pemasukan Harian: ${formatRp(masuk)}</p>
    <p class="keluar-text">Total Pengeluaran Harian: ${formatRp(keluar)}</p>
    <p style="color:${masuk - keluar >= 0 ? 'green' : 'red'}">Saldo Harian: ${formatRp(masuk - keluar)}</p>
  `;
}

/* ===== Update Bulanan ===== */
function updateBulanan() {
  const monthYear = bulanTahunInput.value;
  const selectedFilter = filterJenis.value;
  tabelBulanan.innerHTML = "";
  if (!monthYear) { rekapBulananEl.innerHTML = ""; updateChart(0,0); return; }

  const [y, m] = monthYear.split("-");
  const year = parseInt(y, 10);
  const month = parseInt(m, 10); // 1..12
  let masuk = 0, keluar = 0;

  allData.forEach(d => {
    if (!d.tanggal) return; // skip invalids
    const dt = d.tanggal;
    if (dt.getFullYear() !== year || (dt.getMonth() + 1) !== month) return;
    if (selectedFilter !== "all" && d.jenis !== selectedFilter) return;

    const jenisClass = d.jenis === "pemasukan" ? "jenis-pemasukan" : "jenis-pengeluaran";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dt.toLocaleDateString("id-ID")}</td>
      <td class="${jenisClass}">${d.jenis}</td>
      <td>${formatRp(d.nominal)}</td>
      <td>${d.keterangan}</td>
      <td><button class="delete-btn">Hapus</button></td>
    `;
    row.querySelector("button").addEventListener("click", () => hapusData(d.id));
    tabelBulanan.appendChild(row);

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;
  });

  rekapBulananEl.innerHTML = `
    <p class="masuk-text">Total Pemasukan Bulanan: ${formatRp(masuk)}</p>
    <p class="keluar-text">Total Pengeluaran Bulanan: ${formatRp(keluar)}</p>
    <p style="color:${masuk - keluar >= 0 ? 'green' : 'red'}">Saldo Bulanan: ${formatRp(masuk - keluar)}</p>
  `;

  updateChart(masuk, keluar);
}

/* ===== Saldo Total ===== */
function updateSaldo() {
  let masuk = 0, keluar = 0;
  allData.forEach(d => d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal);
  totalSaldoEl.textContent = `Saldo Saat Ini: ${formatRp(masuk - keluar)}`;
  totalSaldoEl.className = masuk - keluar >= 0 ? "saldo-box saldo-positif" : "saldo-box saldo-negatif";
}

/* ===== Chart ===== */
function updateChart(totalMasuk, totalKeluar) {
  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [{
        label: "Jumlah (Rp)",
        data: [totalMasuk, totalKeluar],
        backgroundColor: ["#27ae60", "#e74c3c"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Perbandingan Pemasukan vs Pengeluaran (Bulan Dipilih)" }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ===== Export CSV ===== */
function exportToCSV() {
  if (!allData.length) return alert("Belum ada data untuk diekspor.");

  let csv = "Tanggal,Jenis,Nominal (Rp),Keterangan\n";
  const rows = allData.slice().sort((a,b) => {
    if (!a.tanggal && !b.tanggal) return 0;
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return a.tanggal - b.tanggal;
  }).map(d => {
    // use original raw if date invalid
    const dateStr = d.tanggal ? `${d.tanggal.getFullYear()}-${String(d.tanggal.getMonth()+1).padStart(2,'0')}-${String(d.tanggal.getDate()).padStart(2,'0')}` : (d.tanggalRaw || "");
    return `${dateStr},${d.jenis},${d.nominal},"${d.keterangan}"`;
  });

  csv += rows.join("\n");

  const totalMasuk = allData.filter(r => r.jenis === "pemasukan").reduce((s, r) => s + r.nominal, 0);
  const totalKeluar = allData.filter(r => r.jenis === "pengeluaran").reduce((s, r) => s + r.nominal, 0);
  csv += `\n\nTotal Pemasukan,${totalMasuk}\nTotal Pengeluaran,${totalKeluar}\nSaldo,${totalMasuk - totalKeluar}\n`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `catatan_keuangan_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ===== Events ===== */
filterJenis.addEventListener("change", () => { updateHarian(); updateBulanan(); });
lihatBulananBtn.addEventListener("click", (e) => { e.preventDefault(); updateBulanan(); });
bulanTahunInput.addEventListener("change", updateBulanan);
exportCSVBtn.addEventListener("click", exportToCSV);

/* ===== Init ===== */
loadData();
