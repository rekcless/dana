import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

// Elemen HTML
const form = document.getElementById('formPengeluaran');
const tanggalInput = document.getElementById('tanggal');
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

// Format input nominal ke Rupiah
nominalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d]/g, '');
    if (value) {
        e.target.value = 'Rp ' + value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    } else {
        e.target.value = '';
    }
});

// Fungsi bantu: format angka ke Rupiah
function formatRupiah(angka) {
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Tambah pengeluaran baru
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tanggal = tanggalInput.value;
    const kategori = kategoriInput.value;
    const nominal = parseInt(nominalInput.value.replace(/[^\d]/g, ''));
    const keterangan = keteranganInput.value;

    if(!tanggal || !kategori || !nominal) return;

    try {
        await addDoc(collection(db, "pengeluaran"), {
            tanggal: new Date(tanggal),
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

// Load semua data dari Firestore
async function loadData(){
    try {
        const snapshot = await getDocs(collection(db, "pengeluaran"));
        allData = [];
        snapshot.forEach(docItem => allData.push({...docItem.data(), id: docItem.id}));

        updateKategoriFilter();
        updateHarian();
        updateBulanan();
    } catch (error) {
        console.error("Gagal load data: ", error);
    }
}

// Update dropdown kategori
function updateKategoriFilter(){
    const kategoriSet = new Set(allData.map(d => d.kategori));
    filterKategori.innerHTML = `<option value="all">Semua</option>`;
    kategoriSet.forEach(k => filterKategori.innerHTML += `<option value="${k}">${k}</option>`);
}

// Update tabel harian
function updateHarian(){
    const today = new Date().toDateString();
    let total = 0;
    tabelHarian.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate().toDateString() : new Date(d.tanggal).toDateString();
        if(tgl === today && (selectedKategori==='all' || d.kategori === selectedKategori)){
            total += d.nominal;
            tabelHarian.innerHTML += `
                <tr>
                    <td>${tgl}</td>
                    <td>${d.kategori}</td>
                    <td>${formatRupiah(d.nominal)}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button onclick="hapusData('${d.id}')">Hapus</button></td>
                </tr>
            `;
        }
    });

    totalHarian.textContent = `Total Harian: ${formatRupiah(total)}`;
}

// Update tabel bulanan
function updateBulanan(){
    const monthYear = bulanTahunInput.value;
    if(!monthYear) return;

    const [year, month] = monthYear.split('-');
    let total = 0;
    tabelBulanan.innerHTML = '';
    const selectedKategori = filterKategori.value;

    allData.forEach(d => {
        const tgl = d.tanggal.toDate ? d.tanggal.toDate() : new Date(d.tanggal);
        if((tgl.getMonth()+1 === parseInt(month)) && (tgl.getFullYear() === parseInt(year)) &&
           (selectedKategori==='all' || d.kategori === selectedKategori)){
            total += d.nominal;
            tabelBulanan.innerHTML += `
                <tr>
                    <td>${tgl.toDateString()}</td>
                    <td>${d.kategori}</td>
                    <td>${formatRupiah(d.nominal)}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button onclick="hapusData('${d.id}')">Hapus</button></td>
                </tr>
            `;
        }
    });

    totalBulanan.textContent = `Total Bulanan: ${formatRupiah(total)}`;
}

// Hapus data pakai PIN
window.hapusData = async function(id) {
    const pin = prompt("Masukkan PIN untuk hapus data:");
    if (pin !== "223344") {
        alert("PIN salah!");
        return;
    }

    if (!confirm("Yakin mau hapus data ini?")) return;

    try {
        await deleteDoc(doc(db, "pengeluaran", id));
        alert("Data berhasil dihapus!");
        loadData();
    } catch (error) {
        console.error("Gagal hapus data: ", error);
        alert("Gagal hapus data. Cek console.");
    }
};

// Event listener
filterKategori.addEventListener('change', () => { updateHarian(); updateBulanan(); });
lihatBulananBtn.addEventListener('click', updateBulanan);

// Load data awal
loadData();
