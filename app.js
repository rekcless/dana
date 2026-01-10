import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const form = document.getElementById("formPengeluaran");
const tabel = document.getElementById("tabelData");
const saldoEl = document.getElementById("totalSaldo");
const rekapHarianEl = document.getElementById("rekapHarian");
const rekapBulananEl = document.getElementById("rekapBulanan");
const bulanInput = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");

let dataAll = [];
let chart = null;

const rupiah = n => "Rp" + n.toLocaleString("id-ID");

document.getElementById("nominal").addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "")
    ? Number(e.target.value.replace(/\D/g, "")).toLocaleString("id-ID")
    : "";
});

form.addEventListener("submit", async e => {
  e.preventDefault();

  const tanggal = document.getElementById("tanggal").value;
  const jenis = document.getElementById("jenis").value;
  const nominal = Number(document.getElementById("nominal").value.replace(/\D/g, ""));
  const ket = document.getElementById("keterangan").value || "-";

  if (!tanggal || !nominal) return alert("Lengkapi data!");

  await addDoc(collection(db, "pengeluaran"), {
    tanggal,
    jenis,
    nominal,
    ket
  });

  form.reset();
  loadData();
});

async function loadData() {
  const snap = await getDocs(collection(db, "pengeluaran"));
  dataAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

loadData();

/* Render semua tampilan */
function render() {
  const bulanFilter = bulanInput.value || new Date().toISOString().slice(0, 7);

  const dataBulan = dataAll.filter(d => d.tanggal.startsWith(bulanFilter));

  tabel.innerHTML = "";
  let totalMasuk = 0, totalKeluar = 0;

  dataBulan.forEach(d => {
    if (d.jenis === "pemasukan") totalMasuk += d.nominal;
    else totalKeluar += d.nominal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.tanggal}</td>
      <td class="${d.jenis === "pemasukan" ? "text-pemasukan" : "text-pengeluaran"}">
        ${d.jenis}
      </td>
      <td class="${d.jenis === "pemasukan" ? "text-pemasukan" : "text-pengeluaran"}">
        ${rupiah(d.nominal)}
      </td>
      <td>${d.ket}</td>
      <td><button class="delete-btn">Hapus</button></td>
    `;

    tr.querySelector("button").onclick = async () => {
      await deleteDoc(doc(db, "pengeluaran", d.id));
      loadData();
    };
    tabel.appendChild(tr);
  });

  // Rekap bulanan
  const saldo = totalMasuk - totalKeluar;
  rekapBulananEl.innerHTML = `
    <h3>Rekap Bulan ${bulanFilter}</h3>
    <p class="text-pemasukan">Total Pemasukan: ${rupiah(totalMasuk)}</p>
    <p class="text-pengeluaran">Total Pengeluaran: ${rupiah(totalKeluar)}</p>
    <p class="${saldo >= 0 ? 'text-pemasukan' : 'text-pengeluaran'}">Saldo: ${rupiah(saldo)}</p>
  `;

  // Rekap harian
  const hariIni = new Date().toISOString().slice(0, 10);
  const dataHari = dataBulan.filter(d => d.tanggal === hariIni);

  let masukHarian = 0, keluarHarian = 0;
  dataHari.forEach(d => {
    d.jenis === "pemasukan" ? masukHarian += d.nominal : keluarHarian += d.nominal;
  });

  rekapHarianEl.innerHTML = `
    <h3>Rekap Hari Ini (${hariIni})</h3>
    <p class="text-pemasukan">Pemasukan: ${rupiah(masukHarian)}</p>
    <p class="text-pengeluaran">Pengeluaran: ${rupiah(keluarHarian)}</p>
  `;

  saldoEl.textContent = `Saldo Saat Ini: ${rupiah(saldo)}`;
  saldoEl.className = `saldo-box ${saldo >= 0 ? "saldo-positif" : "saldo-negatif"}`;

  renderChart(totalMasuk, totalKeluar);
}

/* Tombol filter bulan */
lihatBulananBtn.addEventListener("click", render);

/* Grafik bulanan */
function renderChart(masuk, keluar) {
  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
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
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}
