import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

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
const totalSaldo = document.getElementById('totalSaldo');

let allData = [];

// Tambah data baru
form.addEventListener('submit', async (e) => {
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

// Load data dari Firestore
async function loadData() {
    try {
        const snapshot = await getDocs(collection(db, "pengeluaran"));
        allData = [];
        snapshot.forEach(docu => allData.push({ ...docu.data(), id: docu.id }));

        // Urutkan data terbaru dulu
        allData.sort((a, b) => new Date(b.tanggal.seconds ? a.tanggal.toDate() : a.tanggal) - new Date(a.tanggal.seconds ? b.tanggal.toDate() : b.tanggal));

        updateKategoriFilter();
        updateHarian();
        updateBulanan();
        updateSaldo();
    } catch (error) {
        console.error("Gagal load data: ", error);
    }
}

// Filter kategori
function updateKategoriFilter() {
    const kategoriSet = new Set(allData.map(d => d.kategori));
    filterKategori.innerHTML = `<option value="all">Semua</option>`;
    kategoriSet.forEach(k => filterKategori.innerHTML += `<option value="${k}">${k}</option>`);
}

// Update tabel harian
function updateHarian() {
    const today = new Date().toDateString();
    let total = 0;
    tabelHarian.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if (tgl.toDateString() === today && (selectedKategori === 'all' || d.kategori === selectedKategori)) {
            total += d.jenis === "pengeluaran" ? -d.nominal : d.nominal;
            tabelHarian.innerHTML += `
                <tr>
                    <td>${tgl.toLocaleDateString('id-ID')}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>Rp${d.nominal.toLocaleString('id-ID')}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="delete-btn" data-id="${d.id}">Hapus</button></td>
                </tr>
            `;
        }
    });
    totalHarian.textContent = `Total Harian: Rp${total.toLocaleString('id-ID')}`;

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pin = prompt("Masukkan PIN untuk hapus data:");
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

// Update tabel bulanan
function updateBulanan() {
    const monthYear = bulanTahunInput.value;
    if (!monthYear) return;
    const [year, month] = monthYear.split('-');
    let total = 0;
    tabelBulanan.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if ((tgl.getMonth() + 1 === parseInt(month)) && (tgl.getFullYear() === parseInt(year)) &&
            (selectedKategori === 'all' || d.kategori === selectedKategori)) {
            total += d.jenis === "pengeluaran" ? -d.nominal : d.nominal;
            tabelBulanan.innerHTML += `
                <tr>
                    <td>${tgl.toLocaleDateString('id-ID')}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>Rp${d.nominal.toLocaleString('id-ID')}</td>
                    <td>${d.keterangan || '-'}</td>
                </tr>
            `;
        }
    });
    totalBulanan.textContent = `Total Bulanan: Rp${total.toLocaleString('id-ID')}`;
}

// Update saldo total keseluruhan
function updateSaldo() {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    allData.forEach(d => {
        if (d.jenis === "pemasukan") totalPemasukan += d.nominal;
        else if (d.jenis === "pengeluaran") totalPengeluaran += d.nominal;
    });
    const saldo = totalPemasukan - totalPengeluaran;
    totalSaldo.textContent = `Saldo Saat Ini: Rp${saldo.toLocaleString('id-ID')}`;
}

filterKategori.addEventListener('change', () => { updateHarian(); updateBulanan(); });
lihatBulananBtn.addEventListener('click', updateBulanan);

loadData();
