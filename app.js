// Import Firebase Firestore
import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc } 
from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

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

// ==============================
// 🔢 Format input nominal (Rp x.xxx.xxx)
// ==============================
nominalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^\d]/g, ''); // hapus semua non-angka
    if (value) {
        e.target.value = formatRupiah(value);
    } else {
        e.target.value = '';
    }
});

function formatRupiah(angka) {
    return 'Rp ' + angka.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==============================
// ➕ Tambah pengeluaran baru
// ==============================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tanggal = tanggalInput.value;
    const kategori = kategoriInput.value;
    const nominal = parseInt(nominalInput.value.replace(/[^\d]/g, '')); // hapus Rp dan titik
    const keterangan = keteranganInput.value;

    if(!tanggal || !kategori || !nominal) return alert("Lengkapi semua data!");

    try {
        await addDoc(collection(db, "pengeluaran"), {
            tanggal: new Date(tanggal),
            kategori,
            nominal,
            keterangan
        });
        form.reset();
        alert("✅ Data berhasil ditambahkan!");
        loadData();
    } catch (error) {
        console.error("Gagal menambahkan data: ", error);
        alert("❌ Gagal menambahkan data. Cek console.");
    }
});

// ==============================
// 🔄 Load semua data dari Firestore
// ==============================
async function loadData(){
    try {
        const snapshot = await getDocs(collection(db, "pengeluaran"));
        allData = [];
        snapshot.forEach(docu => allData.push({...docu.data(), id: docu.id}));

        updateKategoriFilter();
        updateHarian();
        updateBulanan();
    } catch (error) {
        console.error("Gagal load data: ", error);
    }
}

// ==============================
// 🔽 Update dropdown kategori
// ==============================
function updateKategoriFilter(){
    const kategoriSet = new Set(allData.map(d => d.kategori));
    filterKategori.innerHTML = `<option value="all">Semua</option>`;
    kategoriSet.forEach(k => filterKategori.innerHTML += `<option value="${k}">${k}</option>`);
}

// ==============================
// 📅 Update tabel harian
// ==============================
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
                    <td>${d.nominal.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="hapus-btn" data-id="${d.id}">🗑️</button></td>
                </tr>
            `;
        }
    });

    totalHarian.textContent = `Total Harian: ${total.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}`;
    addDeleteListeners();
}

// ==============================
// 📆 Update tabel bulanan
// ==============================
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
                    <td>${d.nominal.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}</td>
                    <td>${d.keterangan || '-'}</td>
                    <td><button class="hapus-btn" data-id="${d.id}">🗑️</button></td>
                </tr>
            `;
        }
    });

    totalBulanan.textContent = `Total Bulanan: ${total.toLocaleString('id-ID', {style: 'currency', currency: 'IDR'})}`;
    addDeleteListeners();
}

// ==============================
// 🗑️ Fungsi tombol hapus dengan PIN
// ==============================
function addDeleteListeners() {
    document.querySelectorAll('.hapus-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const pin = prompt("Masukkan PIN untuk menghapus data:");
            if (pin === "223344") {
                try {
                    await deleteDoc(doc(db, "pengeluaran", e.target.dataset.id));
                    alert("🗑️ Data berhasil dihapus!");
                    loadData();
                } catch (error) {
                    console.error(error);
                    alert("❌ Gagal menghapus data. Cek console.");
                }
            } else {
                alert("❌ PIN salah!");
            }
        });
    });
}

// ==============================
// 🎯 Event listener filter & tombol bulanan
// ==============================
filterKategori.addEventListener('change', () => { updateHarian(); updateBulanan(); });
lihatBulananBtn.addEventListener('click', updateBulanan);

// ==============================
// 🚀 Jalankan pertama kali
// ==============================
loadData();
