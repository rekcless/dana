import { db } from "./firebase-config.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

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
function toNumber(v) {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string") {
    const digits = v.replace(/[^\d\-]/g, "");
    const n = Number(digits);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}
function formatRp(n) { return "Rp" + Number(n).toLocaleString("id-ID"); }

/* ===== Nominal input formatting ===== */
nominalInput.addEventListener("input", (e) => {
  const raw = e.target.value.replace(/[^\d]/g, "");
  e.target.value = raw ? Number(raw).toLocaleString("id-ID") : "";
});

/* ===== Submit ===== */
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const tanggal = tanggalInput.value; // "YYYY-MM-DD" STRING
  const jenis = jenisInput.value;
  const nominal = toNumber(nominalInput.value);
  const keterangan = keteranganInput.value || "-";

  if (!tanggal || !nominal) return alert("Isi tanggal dan nominal!");

  try {
    await addDoc(collection(db, "pengeluaran"), {
      tanggal: tanggal, // simpan STRING → anti timezone
      jenis,
      nominal,
      keterangan
    });
    form.reset();
    loadData();
  } catch (err) {
    console.error(err);
    alert("Gagal simpan data");
  }
});

/* ===== Load Data ===== */
async function loadData() {
  try {
    const snap = await getDocs(collection(db, "pengeluaran"));
    allData = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        // convert string ke tanggal stabil (TZ fix)
        tanggal: new Date(data.tanggal + "T00:00:00"),
        jenis: data.jenis || "pengeluaran",
        nominal: toNumber(data.nominal),
        keterangan: data.keterangan || "-"
      };
    });

    allData.sort((a, b) => b.tanggal - a.tanggal);

    updateHarian();
    updateBulanan();
    updateSaldo();
  } catch (err) { console.error(err); }
}

/* ===== Hapus Data ===== */
async function hapusData(id) {
  const pin = prompt("Masukkan PIN untuk hapus data:");
  if (pin !== "223344") return alert("PIN salah!");
  if (!confirm("Yakin mau hapus data ini?")) return;

  try {
    await deleteDoc(doc(db, "pengeluaran", id));
    loadData();
  } catch (err) {
    console.error(err);
    alert("Gagal hapus");
  }
}
window.hapusData = hapusData;

/* ===== Update Harian ===== */
function updateHarian() {
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const selectedFilter = filterJenis.value;

  let masuk = 0, keluar = 0;
  tabelHarian.innerHTML = "";

  allData.forEach(d => {
    if (!d.tanggal) return;

    const dStr = d.tanggal.toISOString().split("T")[0];
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
  if (!monthYear) {
    rekapBulananEl.innerHTML = "";
    updateChart(0, 0);
    return;
  }

  const [y, m] = monthYear.split("-");
  const year = parseInt(y);
  const month = parseInt(m);

  let masuk = 0, keluar = 0;

  allData.forEach(d => {
    if (!d.tanggal) return;

    const dt = d.tanggal;
    if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) return;
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

  allData.forEach(d =>
    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal
  );

  totalSaldoEl.textContent = `Saldo Saat Ini: ${formatRp(masuk - keluar)}`;
  totalSaldoEl.className =
    masuk - keluar >= 0 ? "saldo-box saldo-positif" : "saldo-box saldo-negatif";
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
          backgroundColor: ["#27ae60", "#e74c3c"]
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Perbandingan Pemasukan vs Pengeluaran (Bulan Dipilih)"
        }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ===== Export CSV ===== */
function exportToCSV() {
  if (!allData.length) return alert("Belum ada data untuk diekspor.");

  let csv = "Tanggal,Jenis,Nominal (Rp),Keterangan\n";
  const rows = allData
    .slice()
    .sort((a, b) => a.tanggal - b.tanggal)
    .map(
      d =>
        `${d.tanggal.toISOString().split("T")[0]},${d.jenis},${d.nominal},"${d.keterangan}"`
    );

  csv += rows.join("\n");

  const totalMasuk = allData
    .filter(r => r.jenis === "pemasukan")
    .reduce((s, r) => s + r.nominal, 0);
  const totalKeluar = allData
    .filter(r => r.jenis === "pengeluaran")
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

lihatBulananBtn.addEventListener("click", (e) => {
  e.preventDefault();
  updateBulanan();
});

bulanTahunInput.addEventListener("change", updateBulanan);
exportCSVBtn.addEventListener("click", exportToCSV);

/* ===== Init ===== */
loadData();
