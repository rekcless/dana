import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

/* ----- Elemen ----- */
const form = document.getElementById("formPengeluaran");
const tanggalInput = document.getElementById("tanggal");
const jenisInput = document.getElementById("jenis");
const nominalInput = document.getElementById("nominal");

const tabelHarian = document.querySelector("#tabelHarian tbody");
const tabelBulanan = document.querySelector("#tabelBulanan tbody");

const totalSaldoEl = document.getElementById("totalSaldo");
const totalHarianMasukEl = document.getElementById("totalHarianMasuk");
const totalHarianKeluarEl = document.getElementById("totalHarianKeluar");
const totalHarianSaldoEl = document.getElementById("totalHarianSaldo");
const totalBulananMasukEl = document.getElementById("totalBulananMasuk");
const totalBulananKeluarEl = document.getElementById("totalBulananKeluar");
const totalBulananSaldoEl = document.getElementById("totalBulananSaldo");

const bulanTahunInput = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");
const filterJenis = document.getElementById("filterJenis");
const exportCSVBtn = document.getElementById("exportCSV");

let allData = [];
let chartInstance = null;

/* ===== Helpers ===== */
function toDateObj(tsOrDate) {
  if (!tsOrDate) return null;
  if (typeof tsOrDate.toDate === "function") return tsOrDate.toDate();
  if (tsOrDate instanceof Date) return tsOrDate;
  return new Date(tsOrDate);
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

/* ===== Nominal input formatting (user-friendly) ===== */
nominalInput.addEventListener("input", (e) => {
  const raw = e.target.value.replace(/[^\d]/g, "");
  if (!raw) return (e.target.value = "");
  // tampilkan dengan titik ribuan tanpa "Rp" untuk input cepat
  e.target.value = Number(raw).toLocaleString("id-ID");
});

/* ===== Submit (simpan ke Firestore) ===== */
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const tanggal = tanggalInput.value;
  const jenis = jenisInput.value;
  const nominalRaw = nominalInput.value;
  const nominal = toNumber(nominalRaw);
  if (!tanggal || !nominal) return alert("Isi tanggal dan nominal (lebih dari 0).");

  try {
    await addDoc(collection(db, "pengeluaran"), {
      tanggal: new Date(tanggal),
      jenis,
      nominal,
    });
    form.reset();
    loadData();
  } catch (err) {
    console.error("Gagal simpan:", err);
    alert("Gagal menyimpan data. Cek console.");
  }
});

/* ===== Load semua data & normalisasi ===== */
async function loadData() {
  try {
    const snap = await getDocs(collection(db, "pengeluaran"));
    allData = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        tanggal: toDateObj(data.tanggal),
        jenis: data.jenis || "pengeluaran",
        nominal: toNumber(data.nominal),
      };
    });
    // urut terbaru dulu
    allData.sort((a, b) => b.tanggal - a.tanggal);

    updateHarian();
    updateBulanan(); // jika bulan terpilih, akan render; else kosongkan tabel bulanan
    updateSaldo();
  } catch (err) {
    console.error("Gagal load data:", err);
  }
}

/* ===== Hapus data (PIN) ===== */
async function hapusData(id) {
  const pin = prompt("Masukkan PIN untuk hapus data:");
  if (pin !== "223344") return alert("PIN salah!");
  if (!confirm("Yakin mau hapus data ini?")) return;
  try {
    await deleteDoc(doc(db, "pengeluaran", id));
    loadData();
  } catch (err) {
    console.error("Gagal hapus:", err);
    alert("Gagal hapus data. Cek console.");
  }
}
window.hapusData = hapusData; // supaya bisa dipanggil dari onclick HTML

/* ===== Update Harian ===== */
function updateHarian() {
  const todayStr = new Date().toDateString();
  const selectedFilter = filterJenis.value; // all/pemasukan/pengeluaran

  let masuk = 0,
    keluar = 0;
  tabelHarian.innerHTML = "";

  allData.forEach((d) => {
    if (!d.tanggal) return;
    if (d.tanggal.toDateString() !== todayStr) return;
    if (selectedFilter !== "all" && d.jenis !== selectedFilter) return;

    // row
    const jenisClass =
      d.jenis === "pemasukan" ? "jenis-pemasukan" : "jenis-pengeluaran";
    tabelHarian.innerHTML += `
      <tr>
        <td>${d.tanggal.toLocaleDateString("id-ID")}</td>
        <td class="${jenisClass}">${d.jenis}</td>
        <td>${formatRp(d.nominal)}</td>
        <td><button class="delete-btn" onclick="hapusData('${d.id}')">Hapus</button></td>
      </tr>
    `;

    if (d.jenis === "pemasukan") masuk += d.nominal;
    else keluar += d.nominal;
  });

  totalHarianMasukEl.textContent = `Total Pemasukan Harian: ${formatRp(masuk)}`;
  totalHarianKeluarEl.textContent = `Total Pengeluaran Harian: ${formatRp(keluar)}`;
  totalHarianSaldoEl.textContent = `Saldo Harian: ${formatRp(masuk - keluar)}`;
}

/* ===== Update Bulanan ===== */
function updateBulanan() {
  const monthYear = bulanTahunInput.value;
  const selectedFilter = filterJenis.value;
  tabelBulanan.innerHTML = "";

  if (!monthYear) {
    totalBulananMasukEl.textContent = `Total Pemasukan Bulanan: Rp0`;
    totalBulananKeluarEl.textContent = `Total Pengeluaran Bulanan: Rp0`;
    totalBulananSaldoEl.textContent = `Saldo Bulanan: Rp0`;
    // clear chart
    updateChart(0, 0);
    return;
  }

  const [y, m] = monthYear.split("-");
  const year = parseInt(y),
    month = parseInt(m); // 1-12

  let masuk = 0,
    keluar = 0;
  tabelBulanan.innerHTML = "";

  allData.forEach((d) => {
    if (!d.tanggal) return;
    const dt = d.tanggal;
    if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return;
    if (selectedFilter !== "all" && d.jenis !== selectedFilter) return;

    const jenisClass =
      d.jenis === "pemasukan" ? "jenis-pemasukan" : "jenis-pengeluaran";
    tabelBulanan.innerHTML += `
      <tr>
        <td>${dt.toLocaleDateString("id-ID")}</td>
        <td class="${jenisClass}">${d.jenis}</td>
        <td>${formatRp(d.nominal)}</td>
        <td><button class="delete-btn" onclick="hapusData('${d.id}')">Hapus</button></td>
      </tr>
    `;

    if (d.jenis === "pemasukan") masuk += d.nominal;
    else keluar += d.nominal;
  });

  totalBulananMasukEl.textContent = `Total Pemasukan Bulanan: ${formatRp(masuk)}`;
  totalBulananKeluarEl.textContent = `Total Pengeluaran Bulanan: ${formatRp(keluar)}`;
  totalBulananSaldoEl.textContent = `Saldo Bulanan: ${formatRp(masuk - keluar)}`;

  updateChart(masuk, keluar);
}

/* ===== Update saldo keseluruhan ===== */
function updateSaldo() {
  let masuk = 0,
    keluar = 0;
  allData.forEach((d) => {
    if (d.jenis === "pemasukan") masuk += d.nominal;
    else keluar += d.nominal;
  });
  totalSaldoEl.textContent = `Saldo Saat Ini: ${formatRp(masuk - keluar)}`;
}

/* ===== Chart ===== */
function updateChart(totalMasuk, totalKeluar) {
  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [
        {
          label: "Jumlah (Rp)",
          data: [totalMasuk, totalKeluar],
          backgroundColor: ["#27ae60", "#e74c3c"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Perbandingan Pemasukan vs Pengeluaran (Bulan Dipilih)",
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => v } },
      },
    },
  });
}

/* ===== Export CSV (rapi) ===== */
function exportToCSV() {
  if (!allData.length) return alert("Belum ada data untuk diekspor.");
  // header
  let csv = "Tanggal,Jenis,Nominal (Rp)\n";
  // sort ascending by date for CSV output (older -> newer)
  const rows = allData
    .slice()
    .sort((a, b) => a.tanggal - b.tanggal)
    .map((d) => {
      const iso = d.tanggal.toISOString().split("T")[0]; // YYYY-MM-DD
      return `${iso},${d.jenis},${d.nominal}`;
    });
  csv += rows.join("\n");
  // totals footer
  const totalMasuk = allData
    .filter((r) => r.jenis === "pemasukan")
    .reduce((s, r) => s + r.nominal, 0);
  const totalKeluar = allData
    .filter((r) => r.jenis === "pengeluaran")
    .reduce((s, r) => s + r.nominal, 0);
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
filterJenis.addEventListener("change", () => {
  updateHarian();
  updateBulanan();
});
lihatBulananBtn.addEventListener("click", updateBulanan);
bulanTahunInput.addEventListener("change", updateBulanan);
exportCSVBtn.addEventListener("click", exportToCSV);

/* ===== Init ===== */
loadData();