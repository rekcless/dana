import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
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

/* Format input nominal */
document.getElementById("nominal").addEventListener("input", e => {
  const val = e.target.value.replace(/\D/g, "");
  e.target.value = val ? Number(val).toLocaleString("id-ID") : "";
});

/* Submit data */
form.addEventListener("submit", async e => {
  e.preventDefault();

  const tanggal = document.getElementById("tanggal").value;
  const jenis = document.getElementById("jenis").value;
  const nominal = Number(
    document.getElementById("nominal").value.replace(/\D/g, "")
  );
  const ket = document.getElementById("keterangan").value || "-";

  if (!tanggal || !nominal) {
    alert("Lengkapi data!");
    return;
  }

  await addDoc(collection(db, "pengeluaran"), {
    tanggal,
    jenis,
    nominal,
    ket
  });

  form.reset();
  loadData();
});

/* Load data (URUT DARI TERBARU) */
async function loadData() {
  const q = query(
    collection(db, "pengeluaran"),
    orderBy("tanggal", "desc")
  );

  const snap = await getDocs(q);
  dataAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

loadData();

/* Render tampilan */
function render() {
  /* ===== SALDO GLOBAL (SEMUA DATA) ===== */
  let totalMasukGlobal = 0;
  let totalKeluarGlobal = 0;

  dataAll.forEach(d => {
    if (d.jenis === "pemasukan") totalMasukGlobal += d.nominal;
    else totalKeluarGlobal += d.nominal;
  });

  const saldoGlobal = totalMasukGlobal - totalKeluarGlobal;

  saldoEl.textContent = `Saldo Saat Ini: ${rupiah(saldoGlobal)}`;
  saldoEl.className = `saldo-box ${
    saldoGlobal >= 0 ? "saldo-positif" : "saldo-negatif"
  }`;

  /* ===== FILTER BULAN ===== */
  const bulanFilter =
    bulanInput.value || new Date().toISOString().slice(0, 7);

  const dataBulan = dataAll.filter(d =>
    d.tanggal.startsWith(bulanFilter)
  );

  /* ===== TABEL RIWAYAT ===== */
  tabel.innerHTML = "";
  let totalMasukBulan = 0;
  let totalKeluarBulan = 0;

  dataBulan.forEach(d => {
    if (d.jenis === "pemasukan") totalMasukBulan += d.nominal;
    else totalKeluarBulan += d.nominal;

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

  /* ===== REKAP BULANAN ===== */
  const saldoBulan = totalMasukBulan - totalKeluarBulan;

  rekapBulananEl.innerHTML = `
    <h3>Rekap Bulan ${bulanFilter}</h3>
    <p class="text-pemasukan">Total Pemasukan: ${rupiah(totalMasukBulan)}</p>
    <p class="text-pengeluaran">Total Pengeluaran: ${rupiah(totalKeluarBulan)}</p>
    <p class="${saldoBulan >= 0 ? "text-pemasukan" : "text-pengeluaran"}">
      Saldo: ${rupiah(saldoBulan)}
    </p>
  `;

  /* ===== REKAP HARIAN ===== */
  const hariIni = new Date().toLocaleDateString("en-CA");
  const dataHari = dataBulan.filter(d => d.tanggal === hariIni);

  let masukHarian = 0;
  let keluarHarian = 0;

  dataHari.forEach(d => {
    if (d.jenis === "pemasukan") masukHarian += d.nominal;
    else keluarHarian += d.nominal;
  });

  rekapHarianEl.innerHTML = `
    <h3>Rekap Hari Ini (${hariIni})</h3>
    <p class="text-pemasukan">Pemasukan: ${rupiah(masukHarian)}</p>
    <p class="text-pengeluaran">Pengeluaran: ${rupiah(keluarHarian)}</p>
  `;

  renderChart(totalMasukBulan, totalKeluarBulan);
}

/* Tombol filter bulan */
lihatBulananBtn.addEventListener("click", render);

/* Grafik */
function renderChart(masuk, keluar) {
  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [
        {
          data: [masuk, keluar],
          backgroundColor: ["#27ae60", "#e74c3c"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}
