import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Elemen
const form = document.getElementById("formPengeluaran");
const tanggalInput = document.getElementById("tanggal");
const jenisInput = document.getElementById("jenis");
const kategoriInput = document.getElementById("kategori");
const nominalInput = document.getElementById("nominal");
const keteranganInput = document.getElementById("keterangan");
const tabelHarian = document.querySelector("#tabelHarian tbody");
const totalHarian = document.getElementById("totalHarian");
const tabelBulanan = document.querySelector("#tabelBulanan tbody");
const totalBulanan = document.getElementById("totalBulanan");
const bulanTahunInput = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");
const filterKategori = document.getElementById("filterKategori");
const totalSaldo = document.getElementById("totalSaldo");
const exportBtn = document.getElementById("exportCSV");

let allData = [];
let chartInstance = null;

// Tambah data
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tanggal = tanggalInput.value;
  const jenis = jenisInput.value;
  const kategori = kategoriInput.value;
  const nominal = parseInt(nominalInput.value);
  const keterangan = keteranganInput.value;

  if (!tanggal || !kategori || !nominal) return;

  try {
    await addDoc(collection(db, "pengeluaran"), {
      tanggal: new Date(tanggal),
      jenis,
      kategori,
      nominal,
      keterangan,
    });
    form.reset();
    alert("Data berhasil ditambahkan!");
    loadData();
  } catch (error) {
    console.error("Gagal menambahkan data: ", error);
  }
});

// Load data
async function loadData() {
  const snapshot = await getDocs(collection(db, "pengeluaran"));
  allData = [];
  snapshot.forEach((docItem) =>
    allData.push({ ...docItem.data(), id: docItem.id })
  );
  allData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  updateKategoriFilter();
  updateHarian();
  updateBulanan();
  updateSaldo();
}

// Filter kategori
function updateKategoriFilter() {
  const kategoriSet = new Set(allData.map((d) => d.kategori));
  filterKategori.innerHTML = `<option value="all">Semua</option>`;
  kategoriSet.forEach(
    (k) => (filterKategori.innerHTML += `<option value="${k}">${k}</option>`)
  );
}

// Hapus data
async function hapusData(id) {
  const pin = prompt("Masukkan PIN untuk hapus data:");
  if (pin === "223344") {
    await deleteDoc(doc(db, "pengeluaran", id));
    alert("Data berhasil dihapus!");
    loadData();
  } else {
    alert("PIN salah!");
  }
}

// Rekap harian
function updateHarian() {
  const today = new Date().toDateString();
  let totalPengeluaran = 0;
  let totalPemasukan = 0;
  tabelHarian.innerHTML = "";
  const selectedKategori = filterKategori.value;

  allData.forEach((d) => {
    const tgl = d.tanggal.toDate
      ? d.tanggal.toDate().toDateString()
      : new Date(d.tanggal).toDateString();

    if (
      tgl === today &&
      (selectedKategori === "all" || d.kategori === selectedKategori)
    ) {
      if (d.jenis === "pemasukan") totalPemasukan += d.nominal;
      if (d.jenis === "pengeluaran") totalPengeluaran += d.nominal;

      tabelHarian.innerHTML += `
        <tr>
          <td>${tgl}</td>
          <td>${d.jenis}</td>
          <td>${d.kategori}</td>
          <td>Rp${d.nominal.toLocaleString("id-ID")}</td>
          <td>${d.keterangan || "-"}</td>
          <td><button onclick="hapusData('${d.id}')">Hapus</button></td>
        </tr>`;
    }
  });

  const saldoHarian = totalPemasukan - totalPengeluaran;
  totalHarian.textContent = `Total Harian: +Rp${totalPemasukan.toLocaleString(
    "id-ID"
  )} | -Rp${totalPengeluaran.toLocaleString(
    "id-ID"
  )} | Sisa: Rp${saldoHarian.toLocaleString("id-ID")}`;
}

// Rekap bulanan
function updateBulanan() {
  const monthYear = bulanTahunInput.value;
  if (!monthYear) return;
  const [year, month] = monthYear.split("-");
  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  tabelBulanan.innerHTML = "";
  const selectedKategori = filterKategori.value;

  allData.forEach((d) => {
    const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
    if (
      tgl.getMonth() + 1 === parseInt(month) &&
      tgl.getFullYear() === parseInt(year) &&
      (selectedKategori === "all" || d.kategori === selectedKategori)
    ) {
      if (d.jenis === "pemasukan") totalPemasukan += d.nominal;
      if (d.jenis === "pengeluaran") totalPengeluaran += d.nominal;

      tabelBulanan.innerHTML += `
        <tr>
          <td>${tgl.toLocaleDateString("id-ID")}</td>
          <td>${d.jenis}</td>
          <td>${d.kategori}</td>
          <td>Rp${d.nominal.toLocaleString("id-ID")}</td>
          <td>${d.keterangan || "-"}</td>
        </tr>`;
    }
  });

  const saldoBulanan = totalPemasukan - totalPengeluaran;
  totalBulanan.textContent = `Total Bulanan: +Rp${totalPemasukan.toLocaleString(
    "id-ID"
  )} | -Rp${totalPengeluaran.toLocaleString(
    "id-ID"
  )} | Sisa: Rp${saldoBulanan.toLocaleString("id-ID")}`;

  updateChart(totalPemasukan, totalPengeluaran);
}

// Update saldo total
function updateSaldo() {
  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  allData.forEach((d) => {
    if (d.jenis === "pemasukan") totalPemasukan += d.nominal;
    else totalPengeluaran += d.nominal;
  });
  const saldo = totalPemasukan - totalPengeluaran;
  totalSaldo.textContent = `Saldo Saat Ini: Rp${saldo.toLocaleString("id-ID")}`;
}

// Grafik
function updateChart(totalPemasukan, totalPengeluaran) {
  const ctx = document.getElementById("chartBulanan").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pemasukan", "Pengeluaran"],
      datasets: [
        {
          label: "Jumlah (Rp)",
          data: [totalPemasukan, totalPengeluaran],
          backgroundColor: ["#2ecc71", "#e74c3c"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Perbandingan Pemasukan & Pengeluaran Bulanan",
        },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// Ekspor CSV
function exportToCSV() {
  if (allData.length === 0) {
    alert("Belum ada data untuk diekspor.");
    return;
  }

  let csv = "Tanggal,Jenis,Kategori,Nominal,Keterangan\n";
  allData.forEach((d) => {
    const tgl = d.tanggal.toDate
      ? d.tanggal.toDate().toLocaleDateString("id-ID")
      : new Date(d.tanggal).toLocaleDateString("id-ID");
    csv += `${tgl},${d.jenis},${d.kategori},${d.nominal},${d.keterangan || "-"}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "catatan_keuangan.csv");
  link.click();
}

// Listener
filterKategori.addEventListener("change", () => {
  updateHarian();
  updateBulanan();
});
lihatBulananBtn.addEventListener("click", updateBulanan);
exportBtn.addEventListener("click", exportToCSV);

// Mulai
window.hapusData = hapusData;
loadData();