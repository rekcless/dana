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
const rekapEl = document.getElementById("rekap");
const filterJenis = document.getElementById("filterJenis");
const bulanInput = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");

let dataAll = [];
let chart = null;

/* FORMAT */
const rupiah = n => "Rp" + n.toLocaleString("id-ID");

/* INPUT NOMINAL */
document.getElementById("nominal").addEventListener("input", e => {
  e.target.value = e.target.value.replace(/\D/g, "")
    ? Number(e.target.value.replace(/\D/g, "")).toLocaleString("id-ID")
    : "";
});

/* ADD DATA */
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

/* LOAD DATA */
async function loadData() {
  const snap = await getDocs(collection(db, "pengeluaran"));
  dataAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}
loadData();

/* RENDER */
function render() {
  tabel.innerHTML = "";
  let masuk = 0, keluar = 0;

  const filter = filterJenis.value;

  dataAll.forEach(d => {
    if (filter !== "all" && d.jenis !== filter) return;

    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;

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

  const saldo = masuk - keluar;
  saldoEl.textContent = `Saldo Saat Ini: ${rupiah(saldo)}`;
  saldoEl.className = `saldo-box ${saldo >= 0 ? "saldo-positif" : "saldo-negatif"}`;

  rekapEl.innerHTML = `
    <p class="text-pemasukan">Total Pemasukan: ${rupiah(masuk)}</p>
    <p class="text-pengeluaran">Total Pengeluaran: ${rupiah(keluar)}</p>
  `;

  renderChart(masuk, keluar);
}

filterJenis.addEventListener("change", render);

/* CHART */
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
