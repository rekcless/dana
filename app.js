import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// ================= ELEMENT =================
const form = document.getElementById("formPengeluaran");
const totalSaldoEl = document.getElementById("totalSaldo");

const tabelHarian = document.querySelector("#tabelHarian tbody");
const tabelBulanan = document.querySelector("#tabelBulanan tbody");

const rekapHarian = document.getElementById("rekapHarian");
const rekapBulanan = document.getElementById("rekapBulanan");

const filterJenis = document.getElementById("filterJenis");
const bulanTahun = document.getElementById("bulanTahun");
const lihatBulananBtn = document.getElementById("lihatBulanan");

// ================= UTIL =================
const rupiah = n => n.toLocaleString("id-ID");

// ================= ADD DATA =================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    tanggal: document.getElementById("tanggal").value,
    jenis: document.getElementById("jenis").value,
    nominal: Number(document.getElementById("nominal").value.replace(/\D/g, "")),
    keterangan: document.getElementById("keterangan").value || "",
    createdAt: Date.now()
  };

  if (!data.tanggal || !data.nominal) return alert("Data belum lengkap");

  await addDoc(collection(db, "transaksi"), data);
  form.reset();
  loadData();
});

// ================= LOAD DATA =================
async function loadData() {
  tabelHarian.innerHTML = "";
  tabelBulanan.innerHTML = "";

  let totalMasuk = 0;
  let totalKeluar = 0;

  const q = query(collection(db, "transaksi"), orderBy("tanggal", "desc"));
  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const warna = d.jenis === "pemasukan" ? "text-pemasukan" : "text-pengeluaran";

    if (d.jenis === "pemasukan") totalMasuk += d.nominal;
    else totalKeluar += d.nominal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${warna}">${d.tanggal}</td>
      <td class="${warna}">${d.jenis}</td>
      <td class="${warna}">Rp${rupiah(d.nominal)}</td>
      <td class="${warna}">${d.keterangan || "-"}</td>
      <td>
        <button class="delete-btn" data-id="${docSnap.id}">Hapus</button>
      </td>
    `;
    tabelHarian.appendChild(tr);
  });

  const saldo = totalMasuk - totalKeluar;
  totalSaldoEl.textContent = `Saldo Saat Ini: Rp${rupiah(saldo)}`;
  totalSaldoEl.className = saldo >= 0
    ? "saldo-box saldo-positif"
    : "saldo-box saldo-negatif";

  rekapHarian.innerHTML = `
    <p class="text-pemasukan">Total Pemasukan: Rp${rupiah(totalMasuk)}</p>
    <p class="text-pengeluaran">Total Pengeluaran: Rp${rupiah(totalKeluar)}</p>
  `;

  aktifkanDelete();
}

// ================= DELETE =================
function aktifkanDelete() {
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Hapus data ini?")) return;
      await deleteDoc(doc(db, "transaksi", btn.dataset.id));
      loadData();
    };
  });
}

// ================= FILTER BULANAN =================
lihatBulananBtn.addEventListener("click", async () => {
  const bulan = bulanTahun.value;
  if (!bulan) return alert("Pilih bulan");

  tabelBulanan.innerHTML = "";

  let masuk = 0, keluar = 0;
  const snap = await getDocs(collection(db, "transaksi"));

  snap.forEach(docSnap => {
    const d = docSnap.data();
    if (!d.tanggal.startsWith(bulan)) return;

    const warna = d.jenis === "pemasukan" ? "text-pemasukan" : "text-pengeluaran";
    d.jenis === "pemasukan" ? masuk += d.nominal : keluar += d.nominal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${warna}">${d.tanggal}</td>
      <td class="${warna}">${d.jenis}</td>
      <td class="${warna}">Rp${rupiah(d.nominal)}</td>
      <td class="${warna}">${d.keterangan || "-"}</td>
      <td>-</td>
    `;
    tabelBulanan.appendChild(tr);
  });

  rekapBulanan.innerHTML = `
    <p class="text-pemasukan">Total Pemasukan: Rp${rupiah(masuk)}</p>
    <p class="text-pengeluaran">Total Pengeluaran: Rp${rupiah(keluar)}</p>
  `;
});

// ================= INIT =================
loadData();
