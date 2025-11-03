import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Elemen HTML
const form = document.getElementById('formPengeluaran');
const tanggalInput = document.getElementById('tanggal');
const jenisInput = document.getElementById('jenis');
const kategoriInput = document.getElementById('kategori');
const nominalInput = document.getElementById('nominal');
const keteranganInput = document.getElementById('keterangan');

const tabelHarian = document.querySelector('#tabelHarian tbody');
const totalHarian = document.getElementById('totalHarian');

const tabelBulanan = document.querySelector('#tabelBulanan tbody');
const totalBulanan = document.getElementById('totalBulanan');
const bulanTahunInput = document.getElementById('bulanTahun');
const lihatBulananBtn = document.getElementById('lihatBulanan');

const filterKategori = document.getElementById('filterKategori');

let allData = [];

// === Format Rupiah ===
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(angka);
}

// === Input nominal otomatis format Rp ===
nominalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d]/g, '');
    if (!value) {
        e.target.value = '';
        return;
    }
    e.target.value = formatRupiah(value);
});

// === Tambah data baru ===
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tanggal = tanggalInput.value;
    const jenis = jenisInput.value;
    const kategori = kategoriInput.value.trim();
    const nominal = parseInt(nominalInput.value.replace(/[^\d]/g, ''));
    const keterangan = keteranganInput.value.trim();

    if (!tanggal || !kategori || !nominal || !jenis) return;

    try {
        await addDoc(collection(db, "pengeluaran"), {
            tanggal: new Date(tanggal),
            jenis,
            kategori,
            nominal,
            keterangan
        });
        form.reset();
        alert("Data berhasil ditambahkan!");
        loadData();
    } catch (error) {
        console.error("Gagal menambahkan data: ", error);
        alert("Gagal menambahkan data. Cek console.");
    }
});

// === Load semua data ===
async function loadData() {
    try {
        const snapshot = await getDocs(collection(db, "pengeluaran"));
        allData = [];
        snapshot.forEach(docItem => allData.push({ ...docItem.data(), id: docItem.id }));

        // Urutkan dari terbaru ke terlama
        allData.sort((a, b) => {
            const da = a.tanggal.toDate ? a.tanggal.toDate() : new Date(a.tanggal);
            const db = b.tanggal.toDate ? b.tanggal.toDate() : new Date(b.tanggal);
            return db - da;
        });

        updateKategoriFilter();
        updateHarian();
        updateBulanan();
    } catch (error) {
        console.error("Gagal load data: ", error);
    }
}

// === Update dropdown kategori ===
function updateKategoriFilter() {
    const kategoriSet = new Set(allData.map(d => d.kategori));
    filterKategori.innerHTML = `<option value="all">Semua</option>`;
    kategoriSet.forEach(k => {
        filterKategori.innerHTML += `<option value="${k}">${k}</option>`;
    });
}

// === Update tabel harian ===
function updateHarian() {
    const today = new Date().toDateString();
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    tabelHarian.innerHTML = '';
    const selectedKategori = filterKategori.value;

    const dataSorted = allData.slice().sort((a, b) => {
        const da = a.tanggal.toDate ? a.tanggal.toDate() : new Date(a.tanggal);
        const db = b.tanggal.toDate ? b.tanggal.toDate() : new Date(b.tanggal);
        return db - da;
    });

    dataSorted.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate().toDateString() : new Date(d.tanggal).toDateString();
        if (tgl === today && (selectedKategori === 'all' || d.kategori === selectedKategori)) {
            if (d.jenis === 'pemasukan') totalPemasukan += d.nominal;
            else totalPengeluaran += d.nominal;

            tabelHarian.innerHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>${formatRupiah(d.nominal)}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="deleteBtn" data-id="${d.id}">Hapus</button></td>
                </tr>
            `;
        }
    });

    const saldo = totalPemasukan - totalPengeluaran;
    totalHarian.innerHTML = `
        <p><b>Total Pemasukan:</b> ${formatRupiah(totalPemasukan)}</p>
        <p><b>Total Pengeluaran:</b> ${formatRupiah(totalPengeluaran)}</p>
        <p><b>Saldo Hari Ini:</b> ${formatRupiah(saldo)}</p>
    `;

    setupDeleteButtons();
}

// === Update tabel bulanan ===
function updateBulanan() {
    const monthYear = bulanTahunInput.value;
    if (!monthYear) return;

    const [year, month] = monthYear.split('-');
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    tabelBulanan.innerHTML = '';
    const selectedKategori = filterKategori.value;

    const dataSorted = allData.slice().sort((a, b) => {
        const da = a.tanggal.toDate ? a.tanggal.toDate() : new Date(a.tanggal);
        const db = b.tanggal.toDate ? b.tanggal.toDate() : new Date(b.tanggal);
        return db - da;
    });

    dataSorted.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if (
            (tgl.getMonth() + 1 === parseInt(month)) &&
            (tgl.getFullYear() === parseInt(year)) &&
            (selectedKategori === 'all' || d.kategori === selectedKategori)
        ) {
            if (d.jenis === 'pemasukan') totalPemasukan += d.nominal;
            else totalPengeluaran += d.nominal;

            tabelBulanan.innerHTML += `
                <tr>
                    <td>${tgl.toDateString()}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>${formatRupiah(d.nominal)}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="deleteBtn" data-id="${d.id}">Hapus</button></td>
                </tr>
            `;
        }
    });

    const saldo = totalPemasukan - totalPengeluaran;
    totalBulanan.innerHTML = `
        <p><b>Total Pemasukan:</b> ${formatRupiah(totalPemasukan)}</p>
        <p><b>Total Pengeluaran:</b> ${formatRupiah(totalPengeluaran)}</p>
        <p><b>Saldo Bulan Ini:</b> ${formatRupiah(saldo)}</p>
    `;

    setupDeleteButtons();
}

// === Tombol hapus dengan PIN ===
function setupDeleteButtons() {
    document.querySelectorAll('.deleteBtn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pin = prompt("Masukkan PIN untuk menghapus data:");
            if (pin === "223344") {
                await deleteDoc(doc(db, "pengeluaran", btn.dataset.id));
                alert("Data berhasil dihapus!");
                loadData();
            } else {
                alert("PIN salah!");
            }
        });
    });
}

// === Event listeners ===
filterKategori.addEventListener('change', () => {
    updateHarian();
    updateBulanan();
});
lihatBulananBtn.addEventListener('click', updateBulanan);

// === Load data awal ===
loadData();
