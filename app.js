import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const ADMIN_PIN = "223344";

const form = document.getElementById("form");
const tabel = document.getElementById("tabel");
const saldoBox = document.getElementById("totalSaldo");
const filterBulan = document.getElementById("filterBulan");
const ctx = document.getElementById("chart");

let chart;
let dataAll = [];

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  await addDoc(collection(db, "transaksi"), {
    tanggal: tanggal.value,
    jenis: jenis.value,
    nominal: Number(nominal.value),
    keterangan: keterangan.value
  });

  form.reset();
  loadData();
});

filterBulan.addEventListener("change", loadData);

async function loadData() {
  const snap = await getDocs(collection(db, "transaksi"));
  dataAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

function render() {
  tabel.innerHTML = "";
  let saldo = 0;
  let pemasukan = 0;
  let pengeluaran = 0;

  const bulan = filterBulan.value;

  dataAll
    .filter(d => !bulan || d.tanggal.startsWith(bulan))
    .forEach(d => {
      saldo += d.jenis === "pemasukan" ? d.nominal : -d.nominal;
      d.jenis === "pemasukan" ? pemasukan += d.nominal : pengeluaran += d.nominal;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${d.tanggal}</td>
        <td class="${d.jenis}">${d.jenis}</td>
        <td class="${d.jenis}">Rp${d.nominal.toLocaleString()}</td>
        <td>${d.keterangan || "-"}</td>
        <td><button class="hapus">Hapus</button></td>
      `;

      tr.querySelector(".hapus").onclick = () => hapus(d.id);
      tabel.appendChild(tr);
    });

  saldoBox.textContent = `Saldo: Rp${saldo.toLocaleString()}`;
  saldoBox.className = `saldo-box ${saldo >= 0 ? "saldo-positif" : "saldo-negatif"}`;

  renderChart(pemasukan, pengeluaran);
}

async function hapus(id) {
  const pin = prompt("Masukkan PIN Admin:");
  if (pin !== ADMIN_PIN) return alert("PIN salah!");

  if (!confirm("Yakin hapus transaksi?")) return;

  await deleteDoc(doc(db, "transaksi", id));
  loadData();
}

function renderChart(masuk, keluar) {
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [{
        data: [masuk, keluar],
        backgroundColor: ["#27ae60", "#e74c3c"]
      }]
    }
  });
}

loadData();
