import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const form = document.getElementById('formPengeluaran');
const tanggalInput = document.getElementById('tanggal');
const jenisInput = document.getElementById('jenis');
const kategoriInput = document.getElementById('kategori');
const nominalInput = document.getElementById('nominal');
const keteranganInput = document.getElementById('keterangan');

const tabelHarian = document.querySelector('#tabelHarian tbody');
const tabelBulanan = document.querySelector('#tabelBulanan tbody');

const totalSaldo = document.getElementById('totalSaldo');
const totalHarianMasuk = document.getElementById('totalHarianMasuk');
const totalHarianKeluar = document.getElementById('totalHarianKeluar');
const totalHarianSaldo = document.getElementById('totalHarianSaldo');
const totalBulananMasuk = document.getElementById('totalBulananMasuk');
const totalBulananKeluar = document.getElementById('totalBulananKeluar');
const totalBulananSaldo = document.getElementById('totalBulananSaldo');

const bulanTahunInput = document.getElementById('bulanTahun');
const lihatBulananBtn = document.getElementById('lihatBulanan');
const filterKategori = document.getElementById('filterKategori');

let allData = [];

// Tambah data
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tanggal = tanggalInput.value;
    const jenis = jenisInput.value;
    const kategori = kategoriInput.value;
    const nominal = parseInt(nominalInput.value);
    const keterangan = keteranganInput.value;

    if (!tanggal || !kategori || !nominal) return;

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
});

// Load semua data
async function loadData() {
    const snapshot = await getDocs(collection(db, "pengeluaran"));
    allData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Urutkan dari terbaru
    allData.sort((a, b) => new Date(b.tanggal.seconds ? b.tanggal.toDate() : b.tanggal) - new Date(a.tanggal.seconds ? a.tanggal.toDate() : a.tanggal));

    updateKategoriFilter();
    updateHarian();
    updateBulanan();
    updateSaldo();
}

// Filter kategori
function updateKategoriFilter() {
    const kategoriSet = new Set(allData.map(d => d.kategori));
    filterKategori.innerHTML = `<option value="all">Semua</option>`;
    kategoriSet.forEach(k => filterKategori.innerHTML += `<option value="${k}">${k}</option>`);
}

// Update Harian
function updateHarian() {
    const today = new Date().toDateString();
    let masuk = 0, keluar = 0;
    tabelHarian.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if (tgl.toDateString() === today && (selectedKategori === 'all' || d.kategori === selectedKategori)) {
            const nominalRp = "Rp" + d.nominal.toLocaleString("id-ID");
            tabelHarian.innerHTML += `
                <tr>
                    <td>${tgl.toLocaleDateString('id-ID')}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>${nominalRp}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="delete-btn" data-id="${d.id}">Hapus</button></td>
                </tr>`;
            if (d.jenis === 'pemasukan') masuk += d.nominal;
            else keluar += d.nominal;
        }
    });
    totalHarianMasuk.textContent = `Total Pemasukan Harian: Rp${masuk.toLocaleString("id-ID")}`;
    totalHarianKeluar.textContent = `Total Pengeluaran Harian: Rp${keluar.toLocaleString("id-ID")}`;
    totalHarianSaldo.textContent = `Saldo Harian: Rp${(masuk - keluar).toLocaleString("id-ID")}`;
    addDeleteListeners();
}

// Update Bulanan
function updateBulanan() {
    const monthYear = bulanTahunInput.value;
    if (!monthYear) return;
    const [year, month] = monthYear.split('-');
    let masuk = 0, keluar = 0;
    tabelBulanan.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if (tgl.getFullYear() == year && (tgl.getMonth() + 1) == month &&
            (selectedKategori === 'all' || d.kategori === selectedKategori)) {
            const nominalRp = "Rp" + d.nominal.toLocaleString("id-ID");
            tabelBulanan.innerHTML += `
                <tr>
                    <td>${tgl.toLocaleDateString('id-ID')}</td>
                    <td>${d.jenis}</td>
                    <td>${d.kategori}</td>
                    <td>${nominalRp}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="delete-btn" data-id="${d.id}">Hapus</button></td>
                </tr>`;
            if (d.jenis === 'pemasukan') masuk += d.nominal;
            else keluar += d.nominal;
        }
    });
    totalBulananMasuk.textContent = `Total Pemasukan Bulanan: Rp${masuk.toLocaleString("id-ID")}`;
    totalBulananKeluar.textContent = `Total Pengeluaran Bulanan: Rp${keluar.toLocaleString("id-ID")}`;
    totalBulananSaldo.textContent = `Saldo Bulanan: Rp${(masuk - keluar).toLocaleString("id-ID")}`;
    addDeleteListeners();
}

// Delete listener (PIN)
function addDeleteListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async () => {
            const pin = prompt("Masukkan PIN untuk hapus data:");
            if (pin === "223344") {
                await deleteDoc(doc(db, "pengeluaran", btn.dataset.id));
                alert("Data dihapus!");
                loadData();
            } else {
                alert("PIN salah!");
            }
        };
    });
}

// Update saldo total
function updateSaldo() {
    let masuk = 0, keluar = 0;
    allData.forEach(d => {
        if (d.jenis === "pemasukan") masuk += d.nominal;
        else keluar += d.nominal;
    });
    const saldo = masuk - keluar;
    totalSaldo.textContent = `Saldo Saat Ini: Rp${saldo.toLocaleString("id-ID")}`;
}

// Events
filterKategori.addEventListener('change', () => { updateHarian(); updateBulanan(); });
lihatBulananBtn.addEventListener('click', updateBulanan);
loadData();