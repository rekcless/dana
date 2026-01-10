import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

/* ===== ELEMENT ===== */
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

/* ===== HELPER ===== */
const formatRp = n => "Rp" + Number(n).toLocaleString("id-ID");
const toNumber = v => Number(String(v).replace(/[^\d]/g, "")) || 0;

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

/* ===== FORMAT NOMINAL ===== */
nominalInput.addEventListener("input", e => {
  const raw = e.target.value.replace(/[^\d]/g, "");
  e.target.value = raw ? Number(raw).toLocaleString("id-ID") : "";
});

/* ===== TAMBAH DATA ===== */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const tanggal = tanggalInput.value;
  const jenis = jenisInput.value;
  const nominal = toNumber(nominalInput.value);
  const keterangan = keteranganInput.value || "-";

  if (!tanggal || !nominal) {
    alert("Tanggal & nominal wajib diisi");
    return;
  }

  const [tahun, bulan] = tanggal.split("-");

  await addDoc(collection(db, "pengeluaran"), {
    tanggal,               // STRING YYYY-MM-DD
    jenis,
    nominal,
    keterangan,
    tahun: Number(tahun),
    bulan: Number(bulan)
  });

  form.reset();
  loadData();
});

/* ===== LOAD DATA ===== */
async function loadData() {
  const snap = await getDocs(collection(db, "pengeluaran"));
  allData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateHarian();
  updateBulanan();
  updateSaldo();
}

/* ===== HAPUS ===== */
async function hapusData(id) {
  const pin = prompt("Masukkan PIN:");
  if (pin !== "223344") return alert("PIN salah");
  if (!confirm("Yakin hapus data?")) return;

  await deleteDoc(doc(db, "pengeluaran", id));
  loadData();
}
window.hapusData = hapusData;

/* ===== HARIAN ===== */
function updateHarian() {
  const today = todayStr();
  let masuk = 0, keluar = 0;
  tabelHarian.innerHTML = "";

  allData.forEach(d => {
    if (d.tanggal !== today) return;
    if (filterJenis.value !== "all" && d.jenis !== filterJenis.value) return;

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;

    tabelHarian.innerHTML += `
      <tr>
        <td>${d.tanggal}</td>
        <td>${d.jenis}</td>
        <td>${formatRp(d.nominal)}</td>
        <td>${d.keterangan}</td>
        <td><button onclick="hapusData('${d.id}')">Hapus</button></td>
      </tr>
    `;
  });

  rekapHarianEl.innerHTML = `
    <p>Pemasukan: ${formatRp(masuk)}</p>
    <p>Pengeluaran: ${formatRp(keluar)}</p>
    <p>Saldo: ${formatRp(masuk - keluar)}</p>
  `;
}

/* ===== BULANAN ===== */
function updateBulanan() {
  if (!bulanTahunInput.value) return;
  const [y,m] = bulanTahunInput.value.split("-");
  let masuk = 0, keluar = 0;
  tabelBulanan.innerHTML = "";

  allData.forEach(d => {
    if (d.tahun != y || d.bulan != m) return;
    if (filterJenis.value !== "all" && d.jenis !== filterJenis.value) return;

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;

    tabelBulanan.innerHTML += `
      <tr>
        <td>${d.tanggal}</td>
        <td>${d.jenis}</td>
        <td>${formatRp(d.nominal)}</td>
        <td>${d.keterangan}</td>
        <td><button onclick="hapusData('${d.id}')">Hapus</button></td>
      </tr>
    `;
  });

  rekapBulananEl.innerHTML = `
    <p>Pemasukan: ${formatRp(masuk)}</p>
    <p>Pengeluaran: ${formatRp(keluar)}</p>
    <p>Saldo: ${formatRp(masuk - keluar)}</p>
  `;

  updateChart(masuk, keluar);
}

/* ===== SALDO TOTAL ===== */
function updateSaldo() {
  let saldo = 0;
  allData.forEach(d => d.jenis === "pemasukan" ? saldo += d.nominal : saldo -= d.nominal);
  totalSaldoEl.textContent = `Saldo Saat Ini: ${formatRp(saldo)}`;
}

/* ===== CHART ===== */
function updateChart(masuk, keluar) {
  const ctx = document.getElementById("chartBulanan");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [{
        data: [masuk, keluar],
        backgroundColor: ["#2ecc71", "#e74c3c"]
      }]
    },
    options: { responsive: true }
  });
}

/* ===== EXPORT CSV ===== */
exportCSVBtn.addEventListener("click", () => {
  let csv = "Tanggal,Jenis,Nominal,Keterangan\n";
  allData.forEach(d => {
    csv += `${d.tanggal},${d.jenis},${d.nominal},"${d.keterangan}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "catatan_keuangan.csv";
  a.click();
});

/* ===== EVENT ===== */
filterJenis.addEventListener("change", () => {
  updateHarian();
  updateBulanan();
});
lihatBulananBtn.addEventListener("click", e => {
  e.preventDefault();
  updateBulanan();
});

/* ===== INIT ===== */
loadData();
