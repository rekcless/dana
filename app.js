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

  const d = new Date(tanggal);

  await addDoc(collection(db, "pengeluaran"), {
    tanggal,
    jenis,
    nominal,
    keterangan,
    tahun: d.getFullYear(),
    bulan: d.getMonth() + 1
  });

  form.reset();
  loadData();
});

/* ===== LOAD DATA ===== */
async function loadData() {
  const snap = await getDocs(collection(db, "pengeluaran"));

  allData = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      tanggal: new Date(data.tanggal),
      tanggalRaw: data.tanggal,
      jenis: data.jenis,
      nominal: data.nominal,
      keterangan: data.keterangan
    };
  });

  // 👉 URUT SESUAI TANGGAL (TERBARU DI ATAS)
  allData.sort((a, b) => b.tanggal - a.tanggal);

  updateSaldo();
  updateHarian();
  updateBulanan();
}

/* ===== HAPUS DATA (PIN) ===== */
async function hapusData(id) {
  const pin = prompt("Masukkan PIN Admin:");
  if (pin !== "223344") {
    alert("PIN salah!");
    return;
  }
  if (!confirm("Yakin hapus transaksi ini?")) return;

  await deleteDoc(doc(db, "pengeluaran", id));
  loadData();
}
window.hapusData = hapusData;

/* ===== SALDO TOTAL ===== */
function updateSaldo() {
  let masuk = 0, keluar = 0;
  allData.forEach(d => d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal);

  const saldo = masuk - keluar;
  totalSaldoEl.textContent = `Saldo Saat Ini: ${formatRp(saldo)}`;
  totalSaldoEl.className = saldo >= 0 ? "saldo-box saldo-positif" : "saldo-box saldo-negatif";
}

/* ===== HARIAN ===== */
function updateHarian() {
  tabelHarian.innerHTML = "";
  const today = new Date().toISOString().slice(0, 10);
  let masuk = 0, keluar = 0;

  allData.forEach(d => {
    if (d.tanggalRaw !== today) return;
    if (filterJenis.value !== "all" && d.jenis !== filterJenis.value) return;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${d.tanggal.toLocaleDateString("id-ID")}</td>
      <td class="${d.jenis}">${d.jenis}</td>
      <td class="${d.jenis}">${formatRp(d.nominal)}</td>
      <td class="${d.jenis}">${d.keterangan}</td>
      <td><button class="delete-btn">Hapus</button></td>
    `;
    row.querySelector("button").onclick = () => hapusData(d.id);
    tabelHarian.appendChild(row);

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;
  });

  rekapHarianEl.innerHTML = `
    <p class="pemasukan">Pemasukan: ${formatRp(masuk)}</p>
    <p class="pengeluaran">Pengeluaran: ${formatRp(keluar)}</p>
    <p>Saldo: ${formatRp(masuk - keluar)}</p>
  `;
}

/* ===== BULANAN ===== */
function updateBulanan() {
  tabelBulanan.innerHTML = "";
  if (!bulanTahunInput.value) return;

  const [y, m] = bulanTahunInput.value.split("-");
  let masuk = 0, keluar = 0;

  allData.forEach(d => {
    if (d.tanggal.getFullYear() != y || d.tanggal.getMonth() + 1 != m) return;
    if (filterJenis.value !== "all" && d.jenis !== filterJenis.value) return;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${d.tanggal.toLocaleDateString("id-ID")}</td>
      <td class="${d.jenis}">${d.jenis}</td>
      <td class="${d.jenis}">${formatRp(d.nominal)}</td>
      <td class="${d.jenis}">${d.keterangan}</td>
      <td><button class="delete-btn">Hapus</button></td>
    `;
    row.querySelector("button").onclick = () => hapusData(d.id);
    tabelBulanan.appendChild(row);

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;
  });

  rekapBulananEl.innerHTML = `
    <p class="pemasukan">Pemasukan: ${formatRp(masuk)}</p>
    <p class="pengeluaran">Pengeluaran: ${formatRp(keluar)}</p>
    <p>Saldo: ${formatRp(masuk - keluar)}</p>
  `;

  updateChart(masuk, keluar);
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
        backgroundColor: ["#27ae60", "#e74c3c"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ===== EVENT ===== */
filterJenis.onchange = () => { updateHarian(); updateBulanan(); };
lihatBulananBtn.onclick = e => { e.preventDefault(); updateBulanan(); };
bulanTahunInput.onchange = updateBulanan;
exportCSVBtn.onclick = () => alert("CSV bisa ditambah nanti");

/* ===== INIT ===== */
loadData();
