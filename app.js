import { fullInventory } from './data.js?v=2';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
    getFirestore,
    collection,
    getDocs,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    writeBatch,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";

// Firebase configuration for CIA6
const firebaseConfig = {
  apiKey: "AIzaSyBrT6R7FfLJf8PobA8HVVw2jaVA9bS8ens",
  authDomain: "u6-luisa.firebaseapp.com",
  projectId: "u6-luisa",
  storageBucket: "u6-luisa.firebasestorage.app",
  messagingSenderId: "653116231840",
  appId: "1:653116231840:web:f034f17e2800498e47b9c5",
  measurementId: "G-P42X8H3TFJ"
};

const app = initializeApp(firebaseConfig);
let analytics;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Analytics blocked or failed to load");
}
const db = getFirestore(app);

const IMGBB_API_KEY = "6f61e5ee8f8afa155a55c439b13602e5";

let reviewedCount = 0;
let currentUnit = "CIA6";
let currentCollection = "inventory";

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('inventory-body');
    const totalItemsEl = document.getElementById('total-items');
    const reviewedItemsEl = document.getElementById('reviewed-items');
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-image');
    const closeModal = document.querySelector('.close-modal');

    let currentInventoryData = [];
    window.currentInventoryData = currentInventoryData; // Make it global for history deletion
    const searchInput = document.getElementById('search-input');

    tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center;">Cargando inventario desde Firebase...</td></tr>';
    console.log("DOM Loaded, starting auth check...");

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');
    const inboxBtn = document.getElementById('inbox-btn');
    const inboxModal = document.getElementById('inbox-modal');
    const closeInboxModal = document.querySelector('.close-inbox-modal');
    const inboxList = document.getElementById('inbox-list');
    const inboxBadge = document.getElementById('inbox-badge');

    let currentUserRole = null;
    let inventariador = '';

    // Auth Tabs
    tabLogin.addEventListener('click', () => {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        tabLogin.style.color = 'var(--accent)';
        tabLogin.style.borderBottom = '3px solid var(--accent)';
        tabRegister.style.color = '#64748b';
        tabRegister.style.borderBottom = 'none';
    });
    tabRegister.addEventListener('click', () => {
        registerForm.style.display = 'flex';
        loginForm.style.display = 'none';
        tabRegister.style.color = 'var(--accent)';
        tabRegister.style.borderBottom = '3px solid var(--accent)';
        tabLogin.style.color = '#64748b';
        tabLogin.style.borderBottom = 'none';
    });

    // Check session
    const checkSession = () => {
        const session = localStorage.getItem('userSession');
        console.log("Checking session:", session);
        if (session) {
            try {
                const userData = JSON.parse(session);
                inventariador = userData.username;
                currentUserRole = userData.role;
                
                if (authContainer) authContainer.style.setProperty('display', 'none', 'important');
                if (appContainer) appContainer.style.setProperty('display', 'block', 'important');
                
                console.log("User logged in:", inventariador, currentUserRole);
                
                if (currentUserRole === 'commander') {
                    if (inboxBtn) inboxBtn.style.display = 'flex';
                    if (document.getElementById('manage-users-btn')) document.getElementById('manage-users-btn').style.display = 'flex';
                    listenForInbox();
                    if(typeof listenForUsersList === 'function') listenForUsersList();
                } else {
                    if (inboxBtn) inboxBtn.style.display = 'none';
                    if (document.getElementById('manage-users-btn')) document.getElementById('manage-users-btn').style.display = 'none';
                }
                startRealtimeListener();
            } catch (e) {
                console.error("Session parse error:", e);
                localStorage.removeItem('userSession');
            }
        } else {
            if (authContainer) authContainer.style.display = 'flex';
            if (appContainer) appContainer.style.display = 'none';
        }
    };

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('userSession');
        window.location.reload();
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value.trim();
        const submitBtn = loginForm.querySelector('button');
        submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ingresando...';
        submitBtn.disabled = true;

        if (user === '17010' && pass === 'Adri135Emi135') {
            console.log("Commander login success");
            localStorage.setItem('userSession', JSON.stringify({ username: 'Comandante', role: 'commander' }));
            checkSession();
        } else {
            // Check firestore for regular users
            try {
                const docSnap = await getDocs(collection(db, 'users'));
                let found = false;
                docSnap.forEach(docSnapChild => {
                    const data = docSnapChild.data();
                    if (data.username === user && data.password === pass) {
                        found = true;
                        if (data.status === 'approved') {
                            localStorage.setItem('userSession', JSON.stringify({ username: user, role: 'user' }));
                            checkSession();
                        } else {
                            alert("Tu cuenta está pendiente de aprobación por el comandante.");
                        }
                    }
                });
                if (!found && user === '17010') {
                    alert("Credenciales de comandante incorrectas.");
                } else if (!found) {
                    alert("Credenciales incorrectas.");
                }
            } catch (error) {
                console.error(error);
                alert("Error al conectar con la base de datos.");
            }
        }
        submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> Ingresar';
        submitBtn.disabled = false;
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('register-username').value.trim();
        const pass = document.getElementById('register-password').value.trim();
        const submitBtn = registerForm.querySelector('button');
        submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Solicitando...';
        submitBtn.disabled = true;

        if (user === '17010') {
            alert("No puedes usar este usuario.");
            submitBtn.innerHTML = '<i class="ph ph-user-plus"></i> Solicitar Registro';
            submitBtn.disabled = false;
            return;
        }

        try {
            const userRef = doc(db, 'users', user);
            const userSnap = await getDocs(collection(db, 'users'));
            let exists = false;
            userSnap.forEach(d => { if (d.id === user) exists = true; });
            
            if (exists) {
                alert("El usuario ya existe.");
            } else {
                await setDoc(userRef, {
                    username: user,
                    password: pass,
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
                alert("Registro solicitado. Debes esperar a que el comandante lo apruebe.");
                tabLogin.click();
            }
        } catch (error) {
            console.error(error);
            alert("Error al registrar.");
        }
        submitBtn.innerHTML = '<i class="ph ph-user-plus"></i> Solicitar Registro';
        submitBtn.disabled = false;
    });

    // Inbox Logic (for Commander)
    let inboxUnsubscribe = null;
    function listenForInbox() {
        if (inboxUnsubscribe) inboxUnsubscribe();
        inboxUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            let pendingUsers = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'pending') pendingUsers.push({ id: docSnap.id, ...data });
            });
            
            inboxBadge.textContent = pendingUsers.length;
            inboxList.innerHTML = '';
            
            if (pendingUsers.length === 0) {
                inboxList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay solicitudes pendientes.</p>';
            } else {
                pendingUsers.forEach(user => {
                    const div = document.createElement('div');
                    div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;';
                    div.innerHTML = `
                        <div class="inbox-item-wrapper" style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${user.username}</strong><br>
                                <span style="font-size: 0.8rem; color: #64748b;">Contraseña: ${user.password}</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button class="approve-btn" data-id="${user.id}" style="background: #10b981; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="ph ph-check"></i> Aprobar</button>
                                <button class="reject-btn" data-id="${user.id}" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"><i class="ph ph-x"></i> Rechazar</button>
                            </div>
                        </div>
                    `;
                    inboxList.appendChild(div);
                });

                document.querySelectorAll('.approve-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.dataset.id;
                        await updateDoc(doc(db, 'users', id), { status: 'approved' });
                    });
                });
                document.querySelectorAll('.reject-btn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.dataset.id;
                        if(confirm('¿Seguro que deseas rechazar y eliminar a este usuario?')) {
                            const batch = writeBatch(db);
                            batch.delete(doc(db, 'users', id));
                            await batch.commit();
                        }
                    });
                });
            }
        }, (error) => {
            console.error("Inbox Snapshot Error:", error);
        });
    }

    const manageUsersBtn = document.getElementById('manage-users-btn');
    const manageUsersModal = document.getElementById('manage-users-modal');
    const closeManageUsersModal = document.querySelector('.close-manage-users-modal');
    const commanderRegisterForm = document.getElementById('commander-register-form');
    const approvedUsersList = document.getElementById('approved-users-list');

    let usersListUnsubscribe = null;
    window.listenForUsersList = function() {
        if (usersListUnsubscribe) usersListUnsubscribe();
        usersListUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            let approvedUsers = [];
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'approved') approvedUsers.push({ id: docSnap.id, ...data });
            });
            
            if (approvedUsersList) {
                approvedUsersList.innerHTML = '';
                if (approvedUsers.length === 0) {
                    approvedUsersList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay usuarios aprobados.</p>';
                } else {
                    approvedUsers.forEach(user => {
                        const div = document.createElement('div');
                        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;';
                        div.innerHTML = `
                            <div class="user-item-wrapper" style="display: flex; width: 100%; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong>${user.username}</strong><br>
                                    <span style="font-size: 0.8rem; color: #64748b;">Contraseña: ${user.password}</span>
                                </div>
                                <div>
                                    <button class="delete-user-btn" data-id="${user.id}" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Eliminar Usuario"><i class="ph ph-trash"></i></button>
                                </div>
                            </div>
                        `;
                        approvedUsersList.appendChild(div);
                    });

                    document.querySelectorAll('.delete-user-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.currentTarget.dataset.id;
                            if(confirm(`¿Seguro que deseas eliminar permanentemente al usuario ${id}?`)) {
                                try {
                                    const batch = writeBatch(db);
                                    batch.delete(doc(db, 'users', id));
                                    await batch.commit();
                                } catch (err) {
                                    console.error(err);
                                    alert("Error al eliminar usuario.");
                                }
                            }
                        });
                    });
                }
            }
        });
    }

    if (manageUsersBtn) manageUsersBtn.addEventListener('click', () => manageUsersModal.classList.remove('hidden'));
    if (closeManageUsersModal) closeManageUsersModal.addEventListener('click', () => manageUsersModal.classList.add('hidden'));
    if (manageUsersModal) manageUsersModal.addEventListener('click', (e) => { if (e.target === manageUsersModal) manageUsersModal.classList.add('hidden'); });

    if (commanderRegisterForm) {
        commanderRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = document.getElementById('cmd-reg-user').value.trim();
            const pass = document.getElementById('cmd-reg-pass').value.trim();
            const submitBtn = commanderRegisterForm.querySelector('button');
            submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Creando...';
            submitBtn.disabled = true;

            try {
                const userRef = doc(db, 'users', user);
                const userSnap = await getDocs(collection(db, 'users'));
                let exists = false;
                userSnap.forEach(d => { if (d.id === user) exists = true; });
                
                if (exists) {
                    alert("El usuario ya existe.");
                } else {
                    await setDoc(userRef, {
                        username: user,
                        password: pass,
                        status: 'approved',
                        createdAt: new Date().toISOString()
                    });
                    alert("Usuario común creado y aprobado exitosamente.");
                    commanderRegisterForm.reset();
                }
            } catch (error) {
                console.error(error);
                alert("Error al crear usuario.");
            }
            submitBtn.innerHTML = 'Crear Usuario';
            submitBtn.disabled = false;
        });
    }

    if (inboxBtn) inboxBtn.addEventListener('click', () => inboxModal.classList.remove('hidden'));
    if (closeInboxModal) closeInboxModal.addEventListener('click', () => inboxModal.classList.add('hidden'));
    if (inboxModal) inboxModal.addEventListener('click', (e) => { if (e.target === inboxModal) inboxModal.classList.add('hidden'); });

    // History Modal Logic
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModal = document.querySelector('.close-history-modal');
    const historyList = document.getElementById('history-list');

    if(historyModal) {
        closeHistoryModal.addEventListener('click', () => historyModal.classList.add('hidden'));
        historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.classList.add('hidden'); });
    }

    window.deleteHistoryEntry = async function(itemId, entryId) {
        if (!confirm('¿Seguro que deseas borrar este registro del historial?')) return;
        const itemDoc = currentInventoryData.find(i => i.id === itemId);
        if (!itemDoc) return;
        const entryToRemove = itemDoc.historial.find(h => h.id === entryId);
        if (!entryToRemove) return;

        try {
            await updateDoc(doc(db, currentCollection, itemId), {
                historial: arrayRemove(entryToRemove)
            });
            // Re-open modal to refresh
            const updatedItemDoc = currentInventoryData.find(i => i.id === itemId);
            if(updatedItemDoc) {
                 updatedItemDoc.historial = updatedItemDoc.historial.filter(h => h.id !== entryId);
                 openHistoryModal(updatedItemDoc);
            }
        } catch (e) {
            console.error(e);
            alert("Error al borrar historial");
        }
    }

    function openHistoryModal(item) {
        historyList.innerHTML = '';
        if (!item.historial || item.historial.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #64748b;">No hay historial para este ítem.</p>';
        } else {
            const sortedHistory = [...item.historial].sort((a, b) => b.id - a.id);
            sortedHistory.forEach(entry => {
                const div = document.createElement('div');
                div.style.cssText = 'padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; position: relative;';
                
                let deleteBtnHtml = '';
                if (currentUserRole === 'commander') {
                    deleteBtnHtml = `<button onclick="deleteHistoryEntry('${item.id}', '${entry.id}')" style="position: absolute; right: 10px; top: 10px; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem;" title="Borrar registro"><i class="ph ph-trash"></i></button>`;
                }

                div.innerHTML = `
                    <div class="history-entry-item">
                        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 4px;">${entry.fecha}</div>
                        <div style="margin-bottom: 4px;"><strong>${entry.quien}</strong></div>
                        <div style="font-size: 0.9rem;">${entry.accion}</div>
                        ${deleteBtnHtml}
                    </div>
                `;
                historyList.appendChild(div);
            });
        }
        historyModal.classList.remove('hidden');
    }

    async function logHistory(itemId, accionDesc) {
        if(!inventariador) return;
        const entry = {
            id: Date.now().toString(),
            quien: inventariador,
            accion: accionDesc,
            fecha: new Date().toLocaleString('es-ES')
        };
        try {
            await updateDoc(doc(db, currentCollection, itemId), {
                historial: arrayUnion(entry)
            });
        } catch (e) {
            console.error("Error logging history:", e);
        }
    }

    let unsubscribe = null;

    function startRealtimeListener() {
        console.log("Starting listener for:", currentCollection);
        if (unsubscribe) unsubscribe();

        if (typeof tableBody !== 'undefined') tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center;">Conectando con la base de datos...</td></tr>';

        unsubscribe = onSnapshot(collection(db, currentCollection), (snapshot) => {
            console.log("Received inventory snapshot, size:", snapshot.size);
            currentInventoryData.length = 0; // Maintain reference for global access
            
            if (snapshot.empty) {
                console.log(`Database ${currentCollection} is empty. Populating...`);
                if (typeof tableBody !== 'undefined') tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center;">Inicializando base de datos por primera vez...</td></tr>';
                const batch = writeBatch(db);
                fullInventory.forEach((item) => {
                    const docRef = doc(db, currentCollection, item.codigo);
                    batch.set(docRef, { ...item, estado: "", revisado: false, comentarios: "", fotoUrl: "" });
                });
                batch.commit();
                return;
            }

            currentInventoryData = [];
            let hasExpired = false;
            const todayStr = new Date().toISOString().split('T')[0];
            const batchUpdate = writeBatch(db);

            snapshot.forEach((docSnap) => {
                const item = { id: docSnap.id, ...docSnap.data() };

                if (item.revisado && item.proximaRevision && item.proximaRevision.trim() !== '' && item.proximaRevision < todayStr) {
                    item.revisado = false;
                    batchUpdate.update(doc(db, currentCollection, item.id), { revisado: false, ultimaRevision: "" });
                    hasExpired = true;
                }

                currentInventoryData.push(item);
            });

            if (hasExpired) {
                batchUpdate.commit().catch(e => console.error("Error auto-unchecking:", e));
            }

            currentInventoryData.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true, sensitivity: 'base' }));

            totalItemsEl.textContent = currentInventoryData.length;
            reviewedCount = currentInventoryData.filter(item => item.revisado).length;
            reviewedItemsEl.textContent = reviewedCount;

            const filter = searchInput.value.toLowerCase();
            const filteredData = currentInventoryData.filter(item =>
                (item.descripcion || '').toLowerCase().includes(filter) ||
                (item.codigo || '').toLowerCase().includes(filter)
            );

            const activeElementId = document.activeElement ? document.activeElement.id : null;
            const cursorPosition = document.activeElement ? document.activeElement.selectionStart : null;

            renderTable(filteredData, tableBody, totalItemsEl, reviewedItemsEl, modal, modalImg);

            if (activeElementId) {
                const el = document.getElementById(activeElementId);
                if (el) {
                    el.focus();
                    if (cursorPosition !== null && typeof el.setSelectionRange === 'function') {
                        el.setSelectionRange(cursorPosition, cursorPosition);
                    }
                }
            }
        }, (error) => {
            console.error("Snapshot error:", error);
            tableBody.innerHTML = '<tr><td colspan="15" style="text-align: center; color: red;">Error en tiempo real. Revisa la consola.</td></tr>';
        });
    }

    checkSession();

    // Search input listener
    searchInput.addEventListener('input', () => {
        const filter = searchInput.value.toLowerCase();
        const filteredData = currentInventoryData.filter(item =>
            (item.descripcion || '').toLowerCase().includes(filter) ||
            (item.codigo || '').toLowerCase().includes(filter)
        );
        renderTable(filteredData, tableBody, totalItemsEl, reviewedItemsEl, modal, modalImg);
    });

    function renderTable(inventoryData, tableBody, totalItemsEl, reviewedItemsEl, modal, modalImg) {
        tableBody.innerHTML = '';

        inventoryData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.id = `row-${item.id}`;
            if (item.revisado) tr.classList.add('completed');

            tr.innerHTML = `
                <td data-label="#" style="text-align: center; font-weight: bold; color: var(--accent);">${index + 1}</td>
                <td data-label="Foto">
                    <button class="toggle-btn" id="toggle-${item.id}">
                        <i class="ph ph-caret-right"></i>
                    </button>
                </td>
                <td data-label="Código"><strong>${item.codigo}</strong></td>
                <td data-label="SICAFI">${item.sicafi || ''}</td>
                <td data-label="PF">${item.pf || ''}</td>
                <td data-label="Descripción">${item.descripcion || ''}</td>
                <td data-label="Ubicación">${item.ubicacion || ''}</td>
                <td data-label="Marca">${item.marca || ''}</td>
                <td data-label="Modelo">${item.modelo || ''}</td>
                <td data-label="Serie">${item.serie || ''}</td>
                <td data-label="Estado">
                    <select class="status-select default" id="status-${item.id}" ${item.revisado ? 'disabled' : ''}>
                        <option value="" disabled ${!item.estado ? 'selected' : ''}>Seleccionar...</option>
                        <option value="bueno" ${item.estado === 'bueno' ? 'selected' : ''}>Bueno</option>
                        <option value="malo" ${item.estado === 'malo' ? 'selected' : ''}>Malo</option>
                        <option value="regular" ${item.estado === 'regular' ? 'selected' : ''}>Regular</option>
                        <option value="no-existe" ${item.estado === 'no-existe' ? 'selected' : ''}>No existe</option>
                    </select>
                </td>
                <td data-label="Fecha de Revisión">${item.ultimaRevision || '-'}</td>
                <td data-label="Próxima Rev.">
                    <input type="date" class="comment-input date-input-inline" id="next-rev-${item.id}" value="${item.proximaRevision || ''}" style="padding: 4px; font-size: 0.85rem; width: 130px;" ${item.revisado ? 'disabled' : ''} max="9999-12-31">
                </td>
                <td data-label="Revisión" class="action-column">
                    <div class="checkbox-wrapper">
                        <input type="checkbox" class="custom-checkbox" id="check-${item.id}" ${item.revisado ? 'checked' : ''}>
                    </div>
                </td>
                <td data-label="Comentarios" class="action-column">
                    <textarea class="comment-input" id="comment-${item.id}" rows="1" placeholder="Agregar comentario..." ${item.revisado ? 'disabled' : ''}>${item.comentarios || ''}</textarea>
                </td>
                <td data-label="Historial" class="action-column" style="text-align: center;">
                    <button class="icon-btn history-item-btn" id="history-btn-${item.id}" title="Ver Historial" style="color: #64748b; background: none; border: none; cursor: pointer; font-size: 22px;"><i class="ph ph-clock-counter-clockwise"></i></button>
                </td>
                <td data-label="Acciones" class="action-column" style="display:flex; gap:15px; align-items:center; justify-content:center; padding-top:10px;">
                    <button class="icon-btn edit-item-btn" id="edit-${item.id}" title="Editar Item" style="color: ${item.revisado ? '#9ca3af' : '#3b82f6'}; background: none; border: none; cursor: ${item.revisado ? 'not-allowed' : 'pointer'}; font-size: 22px;" ${item.revisado ? 'disabled' : ''}><i class="ph ph-pencil-simple"></i></button>
                    <button class="icon-btn delete-item-btn" id="delete-item-${item.id}" title="Borrar Item" style="color: ${item.revisado ? '#9ca3af' : '#ef4444'}; background: none; border: none; cursor: ${item.revisado ? 'not-allowed' : 'pointer'}; font-size: 22px;" ${item.revisado ? 'disabled' : ''}><i class="ph ph-trash"></i></button>
                </td>
            `;

            tableBody.appendChild(tr);

            const photoTr = document.createElement('tr');
            photoTr.id = `photo-row-${item.id}`;
            photoTr.className = 'photo-row hidden';
            photoTr.innerHTML = `
                <td colspan="15">
                    <div class="photo-container">
                        <div class="upload-container">
                            <label for="file-${item.id}" class="upload-btn" id="label-${item.id}">
                                <i class="ph ph-camera"></i> Subir Fotografía
                            </label>
                            <input type="file" id="file-${item.id}" class="file-input" accept="image/*">
                            <button id="delete-photo-${item.id}" class="upload-btn ${item.fotoUrl ? '' : 'hidden'}" style="background: #ef4444; color: white; border: 2px solid darkred;">
                                <i class="ph ph-trash"></i> Borrar Foto
                            </button>
                        </div>
                        <img src="${item.fotoUrl || ''}" alt="Foto del item" class="photo-preview-large ${item.fotoUrl ? 'visible' : ''}" id="preview-${item.id}">
                    </div>
                </td>
            `;
            tableBody.appendChild(photoTr);

            // Toggle photo row
            const toggleBtn = tr.querySelector(`#toggle-${item.id}`);
            toggleBtn.addEventListener('click', () => {
                photoTr.classList.toggle('hidden');
                toggleBtn.classList.toggle('expanded');
            });

            // Checkbox (Revisión)
            const checkbox = tr.querySelector(`#check-${item.id}`);
            checkbox.addEventListener('change', async (e) => {
                const isChecked = e.target.checked;

                if (isChecked) {
                    if (!confirm("¿Estás seguro que quieres marcar este boton como registrado?")) {
                        e.target.checked = false;
                        return;
                    }
                } else {
                    if (!confirm("¿estás seguro de que quieres deshabilitar el check?")) {
                        e.target.checked = true;
                        return;
                    }
                }

                const updateData = { revisado: isChecked };

                if (isChecked) {
                    tr.classList.add('completed');
                    reviewedCount++;
                    const today = new Date().toISOString().split('T')[0];
                    updateData.ultimaRevision = `${today} por ${inventariador}`;
                } else {
                    tr.classList.remove('completed');
                    reviewedCount--;
                    updateData.ultimaRevision = "";
                }

                reviewedItemsEl.textContent = reviewedCount;
                await updateDoc(doc(db, currentCollection, item.id), updateData);
                await logHistory(item.id, isChecked ? 'Marcó como revisado' : 'Desmarcó la revisión');
            });

            // Comment
            const commentInput = tr.querySelector(`#comment-${item.id}`);
            let timeoutId;
            commentInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = (e.target.scrollHeight) + 'px';
                clearTimeout(timeoutId);
                timeoutId = setTimeout(async () => {
                    await updateDoc(doc(db, currentCollection, item.id), { comentarios: e.target.value });
                    await logHistory(item.id, `Actualizó comentario: "${e.target.value}"`);
                }, 1000);
            });

            // Status select
            const statusSelect = tr.querySelector(`#status-${item.id}`);
            const updateSelectColor = (val) => {
                statusSelect.className = 'status-select';
                if (val === 'bueno') statusSelect.classList.add('status-bueno');
                if (val === 'malo') statusSelect.classList.add('status-malo');
                if (val === 'regular') statusSelect.classList.add('status-regular');
                if (val === 'no-existe') statusSelect.classList.add('status-no-existe');
            };
            if (item.estado) updateSelectColor(item.estado);
            statusSelect.addEventListener('change', async (e) => {
                updateSelectColor(e.target.value);
                await updateDoc(doc(db, currentCollection, item.id), { estado: e.target.value });
                await logHistory(item.id, `Cambió estado a: ${e.target.value}`);
            });

            // Inline Proxima Revision
            const nextRevInput = tr.querySelector(`#next-rev-${item.id}`);
            nextRevInput.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val) {
                    const parts = val.split('-');
                    if (parts[0] && parts[0].length > 4) {
                        parts[0] = parts[0].substring(0, 4);
                        e.target.value = parts.join('-');
                    }
                }
            });
            nextRevInput.addEventListener('blur', async (e) => {
                if (item.proximaRevision !== e.target.value) {
                    await updateDoc(doc(db, currentCollection, item.id), { proximaRevision: e.target.value });
                    await logHistory(item.id, `Actualizó próxima revisión a: ${e.target.value}`);
                }
            });

            // Delete Item
            const deleteItemBtn = tr.querySelector(`#delete-item-${item.id}`);
            if (deleteItemBtn) {
                deleteItemBtn.addEventListener('click', async () => {
                    if (!confirm(`¿Estás seguro de ELIMINAR el ítem ${item.codigo}? Esta acción no se puede deshacer.`)) return;
                    try {
                        const batch = writeBatch(db);
                        batch.delete(doc(db, currentCollection, item.id));
                        await batch.commit();
                        tr.remove();
                        photoTr.remove();
                        totalItemsEl.textContent = parseInt(totalItemsEl.textContent) - 1;
                        if (item.revisado) { reviewedCount--; reviewedItemsEl.textContent = reviewedCount; }
                    } catch (err) {
                        console.error(err);
                        alert("Error al eliminar item");
                    }
                });
            }

            // View History
            const historyBtn = tr.querySelector(`#history-btn-${item.id}`);
            if (historyBtn) {
                historyBtn.addEventListener('click', () => {
                    openHistoryModal(item);
                });
            }

            // Edit Item
            const editBtn = tr.querySelector(`#edit-${item.id}`);
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    document.getElementById('edit-original-codigo').value = item.id;
                    document.getElementById('edit-codigo').value = item.codigo || '';
                    document.getElementById('edit-sicafi').value = item.sicafi || '';
                    document.getElementById('edit-pf').value = item.pf || '';
                    document.getElementById('edit-descripcion').value = item.descripcion || '';
                    document.getElementById('edit-ubicacion').value = item.ubicacion || '';
                    document.getElementById('edit-marca').value = item.marca || '';
                    document.getElementById('edit-modelo').value = item.modelo || '';
                    document.getElementById('edit-serie').value = item.serie || '';
                    document.getElementById('edit-estado').value = item.estado || '';
                    document.getElementById('edit-ultima-revision').value = item.ultimaRevision || '';
                    document.getElementById('edit-proxima-revision').value = item.proximaRevision || '';
                    document.getElementById('edit-revisado').checked = item.revisado || false;
                    document.getElementById('edit-comentarios').value = item.comentarios || '';
                    document.getElementById('edit-item-modal').classList.remove('hidden');
                });
            }

            // Photo upload (ImgBB)
            const fileInput = photoTr.querySelector(`#file-${item.id}`);
            const previewThumb = photoTr.querySelector(`#preview-${item.id}`);
            const labelBtn = photoTr.querySelector(`#label-${item.id}`);
            const deletePhotoBtn = photoTr.querySelector(`#delete-photo-${item.id}`);

            if (deletePhotoBtn) {
                deletePhotoBtn.addEventListener('click', async () => {
                    if (!confirm('¿Estás seguro de borrar esta foto?')) return;
                    deletePhotoBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Borrando...';
                    try {
                        await updateDoc(doc(db, currentCollection, item.id), { fotoUrl: "" });
                        previewThumb.src = "";
                        previewThumb.classList.remove('visible');
                        deletePhotoBtn.classList.add('hidden');
                        labelBtn.innerHTML = '<i class="ph ph-camera"></i> Subir Fotografía';
                        deletePhotoBtn.innerHTML = '<i class="ph ph-trash"></i> Borrar Foto';
                    } catch (error) {
                        console.error("Error deleting image:", error);
                        alert("Error al borrar la foto.");
                        deletePhotoBtn.innerHTML = '<i class="ph ph-trash"></i> Borrar Foto';
                    }
                });
            }

            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                labelBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Subiendo...';
                try {
                    const formData = new FormData();
                    formData.append("image", file);
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
                    const data = await response.json();
                    if (data.success) {
                        const imageUrl = data.data.url;
                        previewThumb.src = imageUrl;
                        previewThumb.classList.add('visible');
                        deletePhotoBtn.classList.remove('hidden');
                        await updateDoc(doc(db, currentCollection, item.id), { fotoUrl: imageUrl });
                        labelBtn.innerHTML = '<i class="ph ph-check"></i> Subida';
                    } else {
                        throw new Error("ImgBB error");
                    }
                } catch (error) {
                    console.error("Error uploading image:", error);
                    labelBtn.innerHTML = '<i class="ph ph-warning"></i> Error';
                }
            });

            previewThumb.addEventListener('click', () => {
                if (previewThumb.src) {
                    modalImg.src = previewThumb.src;
                    modal.classList.remove('hidden');
                }
            });
        });
    }

    // Close modal
    closeModal.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    // Sync button
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.addEventListener('click', async () => {
        if (!confirm('¿Deseas sincronizar el inventario? (Se agregarán los ítems faltantes sin borrar revisiones)')) return;
        syncBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Sincronizando...';
        syncBtn.disabled = true;
        try {
            const batch = writeBatch(db);
            fullInventory.forEach((item) => {
                const docRef = doc(db, currentCollection, item.codigo);
                batch.set(docRef, {
                    codigo: item.codigo, sicafi: item.sicafi, pf: item.pf,
                    descripcion: item.descripcion, ubicacion: item.ubicacion,
                    marca: item.marca, modelo: item.modelo, serie: item.serie
                }, { merge: true });
            });
            await batch.commit();
            alert('¡Sincronización completada! La página se recargará.');
            window.location.reload();
        } catch (error) {
            console.error("Error syncing:", error);
            alert('Error al sincronizar. Revisa la consola.');
            syncBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Sincronizar';
            syncBtn.disabled = false;
        }
    });

    // Clear DB button
    const clearDbBtn = document.getElementById('clear-db-btn');
    if (clearDbBtn) {
        clearDbBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de borrar TODOS los datos? Esto eliminará todas las revisiones y fotos guardadas.')) return;
            clearDbBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Borrando...';
            clearDbBtn.disabled = true;
            try {
                const snap = await getDocs(collection(db, currentCollection));
                const batch = writeBatch(db);
                snap.forEach((docSnap) => batch.delete(docSnap.ref));
                await batch.commit();
                alert('Base de datos borrada. La página se recargará.');
                window.location.reload();
            } catch (error) {
                console.error("Error clearing database:", error);
                alert('Error al borrar. Revisa la consola.');
                clearDbBtn.innerHTML = '<i class="ph ph-trash"></i> Borrar Todo';
                clearDbBtn.disabled = false;
            }
        });
    }

    // Add Item
    const addItemBtn = document.getElementById('add-item-btn');
    const addItemModal = document.getElementById('add-item-modal');
    const closeAddModal = document.querySelector('.close-add-modal');
    const addItemForm = document.getElementById('add-item-form');

    if (addItemBtn && addItemModal) {
        addItemBtn.addEventListener('click', () => addItemModal.classList.remove('hidden'));
        closeAddModal.addEventListener('click', () => addItemModal.classList.add('hidden'));
        addItemModal.addEventListener('click', (e) => { if (e.target === addItemModal) addItemModal.classList.add('hidden'); });

        addItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addItemForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
            submitBtn.disabled = true;

            const newItem = {
                codigo: document.getElementById('add-codigo').value.trim(),
                sicafi: document.getElementById('add-sicafi').value.trim(),
                pf: document.getElementById('add-pf').value.trim(),
                descripcion: document.getElementById('add-descripcion').value.trim(),
                ubicacion: document.getElementById('add-ubicacion').value.trim(),
                marca: document.getElementById('add-marca').value.trim(),
                modelo: document.getElementById('add-modelo').value.trim(),
                serie: document.getElementById('add-serie').value.trim(),
                estado: "", revisado: false, comentarios: "", fotoUrl: ""
            };

            try {
                const existingDoc = await getDocs(collection(db, currentCollection));
                let exists = false;
                existingDoc.forEach(d => { if (d.id === newItem.codigo) exists = true; });
                if (exists) {
                    alert('Ya existe un item con ese código.');
                    submitBtn.innerHTML = 'Guardar Item';
                    submitBtn.disabled = false;
                    return;
                }
                await setDoc(doc(db, currentCollection, newItem.codigo), newItem);
                alert('Item guardado correctamente. La página se recargará.');
                window.location.reload();
            } catch (error) {
                console.error("Error adding item:", error);
                alert('Error al guardar el item.');
                submitBtn.innerHTML = 'Guardar Item';
                submitBtn.disabled = false;
            }
        });
    }

    // Edit Item Modal
    const editItemModal = document.getElementById('edit-item-modal');
    const closeEditModal = document.querySelector('.close-edit-modal');
    const editItemForm = document.getElementById('edit-item-form');

    if (editItemModal) {
        closeEditModal.addEventListener('click', () => editItemModal.classList.add('hidden'));
        editItemModal.addEventListener('click', (e) => { if (e.target === editItemModal) editItemModal.classList.add('hidden'); });

        editItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = editItemForm.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Guardando...';
            submitBtn.disabled = true;

            const originalCodigo = document.getElementById('edit-original-codigo').value;
            const isChecked = document.getElementById('edit-revisado').checked;
            const updatedItem = {
                sicafi: document.getElementById('edit-sicafi').value.trim(),
                pf: document.getElementById('edit-pf').value.trim(),
                descripcion: document.getElementById('edit-descripcion').value.trim(),
                ubicacion: document.getElementById('edit-ubicacion').value.trim(),
                marca: document.getElementById('edit-marca').value.trim(),
                modelo: document.getElementById('edit-modelo').value.trim(),
                serie: document.getElementById('edit-serie').value.trim(),
                estado: document.getElementById('edit-estado').value,
                proximaRevision: document.getElementById('edit-proxima-revision').value,
                revisado: isChecked,
                comentarios: document.getElementById('edit-comentarios').value.trim()
            };

            const currentItem = currentInventoryData.find(i => i.codigo === originalCodigo);
            if (isChecked && currentItem && !currentItem.revisado) {
                const today = new Date().toISOString().split('T')[0];
                updatedItem.ultimaRevision = `${today} por ${inventariador}`;
            }

            try {
                await updateDoc(doc(db, currentCollection, originalCodigo), updatedItem);
                await logHistory(originalCodigo, 'Editó el ítem desde el panel de edición');
                alert('Item actualizado correctamente. La página se recargará.');
                window.location.reload();
            } catch (error) {
                console.error("Error updating item:", error);
                alert('Error al actualizar el item.');
                submitBtn.innerHTML = 'Actualizar Item';
                submitBtn.disabled = false;
            }
        });
    }

    // Export PDF
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', async () => {
            if (typeof window.jspdf === 'undefined') {
                alert('La librería PDF no se ha cargado.');
                return;
            }
            exportPdfBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generando PDF...';
            try {
                const { jsPDF } = window.jspdf;
                const pdfDoc = new jsPDF({ orientation: 'landscape' });
                pdfDoc.text(`Inventario ${currentUnit}`, 14, 15);
                pdfDoc.setFontSize(10);

                const fetchImageAsBase64 = (url) => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'Anonymous';
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                            ctx.drawImage(img, 0, 0);
                            try { resolve(canvas.toDataURL('image/jpeg', 0.8)); } catch (e) { resolve(null); }
                        };
                        img.onerror = () => {
                            const proxyImg = new Image();
                            proxyImg.crossOrigin = 'Anonymous';
                            proxyImg.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = proxyImg.width;
                                canvas.height = proxyImg.height;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = "#ffffff";
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                                ctx.drawImage(proxyImg, 0, 0);
                                try { resolve(canvas.toDataURL('image/jpeg', 0.8)); } catch (e) { resolve(null); }
                            };
                            proxyImg.onerror = () => resolve(null);
                            proxyImg.src = 'https://corsproxy.io/?' + encodeURIComponent(url);
                        };
                        img.src = url;
                    });
                };

                const pdfSnap = await getDocs(collection(db, currentCollection));
                const pdfData = [];
                let pdfIdx = 1;
                for (const docSnap of pdfSnap.docs) {
                    const item = docSnap.data();
                    let base64Img = '';
                    if (item.fotoUrl) base64Img = await fetchImageAsBase64(item.fotoUrl) || '';
                    pdfData.push([
                        base64Img, pdfIdx++,
                        item.codigo || '', item.sicafi || '', item.pf || '',
                        item.descripcion || '', item.ubicacion || '',
                        item.marca || '', item.modelo || '', item.serie || '',
                        item.estado || '', item.revisado ? 'Sí' : 'No', item.comentarios || ''
                    ]);
                }

                pdfDoc.autoTable({
                    startY: 20,
                    head: [['Foto', '#', 'Código', 'SICAFI', 'PF', 'Descripción', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Estado', 'Revisado', 'Comentarios']],
                    body: pdfData,
                    theme: 'grid',
                    styles: { fontSize: 7.5, minCellHeight: 35, valign: 'middle', halign: 'left', cellPadding: 1, overflow: 'linebreak' },
                    headStyles: { fillColor: [139, 0, 0], halign: 'center', fontSize: 7.5, fontStyle: 'bold' },
                    columnStyles: {
                        0: { cellWidth: 35 }, 1: { cellWidth: 10, halign: 'center' },
                        2: { cellWidth: 20, halign: 'center' }, 3: { cellWidth: 18 },
                        4: { cellWidth: 15 }, 5: { cellWidth: 'auto' },
                        6: { cellWidth: 25 }, 7: { cellWidth: 18 },
                        8: { cellWidth: 18 }, 9: { cellWidth: 22 },
                        10: { cellWidth: 15, halign: 'center' }, 11: { cellWidth: 15, halign: 'center' },
                        12: { cellWidth: 25 }
                    },
                    didDrawCell: function (data) {
                        if (data.column.index === 0 && data.cell.section === 'body') {
                            const base64 = data.row.raw[0];
                            if (base64 && base64.startsWith('data:image')) {
                                const padding = 2;
                                const size = data.cell.width - (padding * 2);
                                pdfDoc.addImage(base64, 'JPEG', data.cell.x + padding, data.cell.y + padding, size, size);
                            }
                        }
                    },
                    didParseCell: function (data) {
                        if (data.column.index === 0 && data.cell.section === 'body') data.cell.text = '';
                    }
                });

                pdfDoc.save('inventario_cia6.pdf');
            } catch (err) {
                console.error("Error generating PDF:", err);
                alert('Error al generar PDF');
            } finally {
                exportPdfBtn.innerHTML = '<i class="ph ph-file-pdf"></i> PDF';
            }
        });
    }

    // Export Excel
    const exportExcelBtn = document.getElementById('export-excel-btn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', async () => {
            if (typeof XLSX === 'undefined') {
                alert('La librería Excel no se ha cargado.');
                return;
            }
            exportExcelBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generando Excel...';
            try {
                const excelSnap = await getDocs(collection(db, currentCollection));
                let excelIdx = 1;
                const excelData = excelSnap.docs.map(docSnap => {
                    const item = docSnap.data();
                    return {
                        '#': excelIdx++,
                        'Código': item.codigo || '',
                        'SICAFI': item.sicafi || '',
                        'PF': item.pf || '',
                        'Descripción': item.descripcion || '',
                        'Ubicación': item.ubicacion || '',
                        'Marca': item.marca || '',
                        'Modelo': item.modelo || '',
                        'Serie': item.serie || '',
                        'Estado': item.estado || '',
                        'Revisado': item.revisado ? 'Sí' : 'No',
                        'Comentarios': item.comentarios || '',
                        'URL Foto': item.fotoUrl || ''
                    };
                });

                const worksheet = XLSX.utils.json_to_sheet(excelData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
                XLSX.writeFile(workbook, "inventario_cia6.xlsx");
            } catch (err) {
                console.error("Error generating Excel:", err);
                alert('Error al generar Excel');
            } finally {
                exportExcelBtn.innerHTML = '<i class="ph ph-file-xls"></i> Excel';
            }
        });
    }

    // --- Smart AI Assistant Logic ---
    const aiInput = document.getElementById('ai-input');
    const sendAi = document.getElementById('send-ai');
    const aiMessages = document.getElementById('ai-messages');

    if (aiInput && sendAi && aiMessages) {
        function addMessage(text, sender, actions = []) {
            const div = document.createElement('div');
            div.className = `ai-message ${sender}`;
            div.innerHTML = text;

            if (actions.length > 0) {
                const actionsDiv = document.createElement('div');
                actionsDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;';
                actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.innerHTML = action.label;
                    btn.style.cssText = 'background:#6366f1;color:white;border:none;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:600;display:flex;align-items:center;gap:6px;';
                    btn.addEventListener('click', action.handler);
                    actionsDiv.appendChild(btn);
                });
                div.appendChild(actionsDiv);
            }

            if (aiMessages.style.maxHeight === '0px' || !aiMessages.style.maxHeight) {
                aiMessages.style.padding = '1.5rem';
                aiMessages.style.maxHeight = '500px';
                aiMessages.style.overflowY = 'auto';
            }
            aiMessages.appendChild(div);
            aiMessages.scrollTop = aiMessages.scrollHeight;
        }

        // Función para filtrar la tabla en pantalla
        function filterTableWith(term) {
            searchInput.value = term;
            searchInput.dispatchEvent(new Event('input'));
        }

        // Función para descargar PDF de un conjunto de ítems
        async function downloadFilteredPDF(items, titulo) {
            if (typeof window.jspdf === 'undefined') {
                addMessage("⚠️ La librería de PDF no está disponible.", 'assistant');
                return;
            }
            addMessage(`⏳ Generando PDF de <strong>${items.length}</strong> ítems de "${titulo}"...`, 'assistant');
            const { jsPDF } = window.jspdf;
            const pdfDoc = new jsPDF({ orientation: 'landscape' });
            pdfDoc.text(`Inventario ${currentUnit} — Filtro: "${titulo}"`, 14, 15);
            pdfDoc.setFontSize(9);
            const pdfData = items.map((item, idx) => [
                idx + 1,
                item.codigo || '', item.sicafi || '', item.pf || '',
                item.descripcion || '', item.ubicacion || '',
                item.marca || '', item.modelo || '', item.serie || '',
                item.estado || '', item.revisado ? 'Sí' : 'No', item.comentarios || ''
            ]);
            pdfDoc.autoTable({
                startY: 20,
                head: [['#', 'Código', 'SICAFI', 'PF', 'Descripción', 'Ubicación', 'Marca', 'Modelo', 'Serie', 'Estado', 'Revisado', 'Comentarios']],
                body: pdfData,
                theme: 'grid',
                styles: { fontSize: 7.5, valign: 'middle', halign: 'left', overflow: 'linebreak' },
                headStyles: { fillColor: [99, 102, 241], halign: 'center', fontSize: 7.5, fontStyle: 'bold' }
            });
            pdfDoc.save(`inventario_${titulo.replace(/\s+/g, '_')}.pdf`);
            addMessage(`✅ ¡PDF listo! Se han descargado <strong>${items.length}</strong> ítems de "${titulo}". 📄`, 'assistant');
        }

        // Función para descargar Excel de un conjunto de ítems
        function downloadFilteredExcel(items, titulo) {
            if (typeof XLSX === 'undefined') {
                addMessage("⚠️ La librería de Excel no está disponible.", 'assistant');
                return;
            }
            const excelData = items.map((item, idx) => ({
                '#': idx + 1,
                'Código': item.codigo || '', 'SICAFI': item.sicafi || '', 'PF': item.pf || '',
                'Descripción': item.descripcion || '', 'Ubicación': item.ubicacion || '',
                'Marca': item.marca || '', 'Modelo': item.modelo || '', 'Serie': item.serie || '',
                'Estado': item.estado || '', 'Revisado': item.revisado ? 'Sí' : 'No',
                'Comentarios': item.comentarios || ''
            }));
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Filtrado");
            XLSX.writeFile(workbook, `inventario_${titulo.replace(/\s+/g, '_')}.xlsx`);
            addMessage(`✅ ¡Excel listo!`, 'assistant');
        }

        let chatHistory = [];
        let lastMatchedItems = [];
        let lastKeywords = [];

        async function processAiQuery(query) {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'ai-message assistant';
            typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
            aiMessages.style.padding = '1.5rem';
            aiMessages.style.maxHeight = '800px';
            aiMessages.appendChild(typingDiv);
            aiMessages.scrollTop = aiMessages.scrollHeight;

            if (!currentInventoryData || currentInventoryData.length === 0) {
                typingDiv.remove();
                addMessage("⚠️ Los datos aún no han cargado.", 'assistant');
                return;
            }

            // ─── NORMALIZATION ───────────────────────────────────────────────
            function norm(str) {
                let s = (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (s.endsWith("es") && s.length > 4) s = s.slice(0, -2);
                else if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
                return s;
            }

            const qNorm = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // ─── FIREFIGHTER SYNONYM DICTIONARY ──────────────────────────────
            const SYNONYMS = {
                'tramo':['tramo'],'tramos':['tramo'],'manguera':['manguera','tramo'],
                'mangueras':['manguera','tramo'],'linea':['linea','tramo','manguera'],
                'lineas':['linea','tramo'],'hose':['tramo','manguera'],
                'piton':['piton'],'pitones':['piton'],'lanza':['piton','lanza'],
                'boquilla':['piton','boquilla'],'nozzle':['piton'],
                'pitón':['piton'],'pitónes':['piton'],
                'reduccion':['reduccion','adaptador'],'adaptador':['adaptador','reduccion'],
                'siames':['siames'],'bifurcacion':['bifurcacion','siames'],
                'copl':['copl','acoplamiento'],'acoplamiento':['acoplamiento','copl'],
                'llave':['llave'],'espanero':['espanero','llave'],
                'scba':['equipo de respiracion','scba','msa','msn','respiracion'],
                'aire':['aire','equipo de respiracion','cilindro'],
                'cilindro':['cilindro','tanque'],'cilindros':['cilindro','tanque'],
                'tanque':['cilindro','tanque'],'tanques':['cilindro','tanque'],
                'oxigeno':['oxigeno','aire','cilindro'],'mascarilla':['mascarilla','mascara'],
                'mascara':['mascarilla','mascara'],'regulador':['regulador'],
                'arnés':['arnes','arnés'],'arnes':['arnes'],
                'hacha':['hacha'],'hachas':['hacha'],'destral':['hacha','destral'],
                'palanca':['palanca','barreta'],'barreta':['barreta','palanca'],
                'cizalla':['cizalla'],'cizallas':['cizalla'],
                'excarcelador':['excarcelador','hidraulico'],'hidraulico':['hidraulico'],
                'pinza':['pinza','cizalla'],'cortador':['cizalla','cortador'],
                'separador':['separador','hidraulico'],'ram':['ram','hidraulico'],
                'combi':['combi','hidraulico'],'herramienta':['herramienta','hidraulico'],
                'escalera':['escalera'],'escaleras':['escalera'],'escala':['escalera'],
                'escalas':['escalera'],'ladder':['escalera'],
                'casco':['casco'],'cascos':['casco'],'helmet':['casco'],
                'guante':['guante'],'guantes':['guante'],'glove':['guante'],
                'bota':['bota'],'botas':['bota'],'boot':['bota'],
                'chaqueton':['chaqueton','chaqueta'],'chaqueta':['chaqueton','chaqueta'],
                'abrigo':['chaqueton'],'pantalon':['pantalon'],'pantalones':['pantalon'],
                'capucha':['capucha'],'pasamontaña':['capucha','pasamontana'],
                'ropa':['chaqueton','pantalon'],'uniforme':['chaqueton','pantalon'],
                'epp':['casco','guante','bota','chaqueton'],
                'linterna':['linterna','lampara'],'linternas':['linterna','lampara'],
                'lampara':['lampara','linterna'],'luz':['linterna','lampara','reflector'],
                'generador':['generador'],'generadores':['generador'],
                'reflector':['reflector','lampara'],'reflectores':['reflector'],
                'cable':['cable'],'extension':['cable','extension'],
                'motosierra':['motosierra','sierra'],'sierra':['motosierra','sierra'],
                'motobomba':['motobomba','bomba'],'bomba':['motobomba','bomba'],
                'motor':['motor','motosierra','motobomba'],
                'extintor':['extintor','extinguidor'],'extintores':['extintor','extinguidor'],
                'extinguidor':['extintor','extinguidor'],'extinguish':['extintor'],
                'co2':['co2','extintor'],'pqs':['pqs','extintor'],
                'cuerda':['cuerda','linea de vida','soga'],'cuerdas':['cuerda','soga'],
                'soga':['soga','cuerda'],'sogas':['soga','cuerda'],
                'vida':['linea de vida','cuerda'],'rappel':['cuerda','descensor'],
                'descensor':['descensor','cuerda'],'ascensor':['ascensor'],
                'mosqueton':['mosqueton'],'arnes_alt':['arnes'],
                'botiquin':['botiquin','primeros auxilios','kit'],
                'camilla':['camilla'],'camillas':['camilla'],
                'oximetro':['oximetro'],'desfibrilador':['desfibrilador','dea'],
                'dea':['dea','desfibrilador'],'collar':['collar','inmovilizador'],
                'inmovilizador':['inmovilizador','collar'],
                'radio':['radio'],'radios':['radio'],
                'comunicacion':['radio','comunicacion'],'handie':['radio'],
                'walkie':['radio'],'driver':['driver','sirena'],
                'sirena':['sirena','driver'],'bocina':['sirena','bocina'],
                'kit':['kit','bolsa','maletin'],'bolsa':['bolsa','kit'],
                'maletin':['maletin','kit'],'cono':['cono'],
                'triangulo':['triangulo','cono'],'señal':['señal','cono','triangulo'],
                'chaleco':['chaleco'],'chalecos':['chaleco'],
                'careta':['careta','mascara','escudo'],'escudo':['escudo','careta'],
                'visor':['visor','careta'],'foco':['linterna','foco'],
                'pico':['pico'],'pala':['pala'],'azadon':['azadon','pala','pico'],
                'soplete':['soplete'],'plasma':['plasma','cortador'],
            };

            function expandWithSynonyms(word) { return SYNONYMS[word] || [word]; }

            const INTENTS = {
                download_pdf:   /\bpdf\b|descarg.*pdf|reporte|imprim|export.*pdf|genera.*pdf|baja.*pdf/.test(qNorm),
                download_excel: /\bexcel\b|\bxls\b|descarg.*excel|export.*excel|genera.*excel/.test(qNorm),
                show_table:     /\b(muestr|mostr|enseñ|tabla|ver\s+list|ver\s+todo|visualiz|ponm|filtrar|filtr)\b/.test(qNorm),
                classify:       /clasific|subcategor|subgenero|subtipo|tipo\s+de|tipos\s+de|tipos?\s+hay|cuales?\s+(son|tipo|hay|exist)|agrup|organiz|diferent|distint|variedad|variant|separa|desglos|listado\s+de|que\s+tipos|cuantos\s+tipos/.test(qNorm),
                analyze:        /analiz|compar|estadistic|resumen|informe|promedio|balance|resum|totale|cuadro/.test(qNorm),
                affirm:         /^(si[\s,!]|sí|claro|dale|por supuesto|ok|hazlo|adelante|positivo|correcto|exacto|afirmativo|bueno|listo|genera|procede)/.test(qNorm) || qNorm.trim() === 'si' || qNorm.trim() === 'sí',
                greet:          /^(hola|buenas|saludos|hey|buenos|hi\b|buen dia|buen tarde|buenas noches)/.test(qNorm),
                status:         /\b(estado|condicion|funciona|malo|bueno|daña|roto|bien|operativ|disponible|sirve|funcional)\b/.test(qNorm),
                location:       /\b(donde|ubicacion|estan|se encuentra|lugar|sitio|sector|guardado|almacena)\b/.test(qNorm),
            };

            if (INTENTS.affirm) {
                const lastAssistantMsg = [...chatHistory].reverse().find(m => m.role === 'assistant');
                if (lastAssistantMsg && lastAssistantMsg.content.includes("reporte")) {
                    INTENTS.download_pdf = true;
                }
            }

            let cleanQuery = qNorm
                .replace(/^(dame|digame|dime|muestra|enseña|listame|necesito saber|quiero saber|quiero ver|quiero que me|que me digas|me puedes decir)\s+(los?|las?|un|una|el|la)?\s*/i, '')
                .replace(/\b(tipos?\s+de|clases?\s+de|tipos?\s+hay\s+de|que\s+tipos?\s+(hay|existen|tienen)?)\s*/gi, '')
                .replace(/\b(cuantos?\s+(tipos?|clases?|hay)\s+(de|en|con)?)\s*/gi, '')
                .replace(/\b(cuales?\s+son\s+(los?|las?)?)\s*/gi, '')
                .replace(/\b(que\s+(tipo|clase|modelo|marca)\s+(de|tienen)?)\s*/gi, '')
                .trim();

            const stopWordsNorm = new Set([
                'hola','saludo','si','no','clar','ok','gracia','porfa','favor','please','bueno','bien',
                'cuant','cuanta','cuanto','cuantos','cuantas','donde','hay','que','como','cual','cuales',
                'quien','cuando','porque','cuales','existe','existen','tienen','tienes',
                'tipo','tipos','tip','clase','clases','clas','modelo','modelos','categoria','categorias',
                'variedad','variedades','version','versiones','marca','marcas','subtipo','subtipos',
                'de','el','la','lo','le','los','las','un','una','al','del','en','por','para','con','sin',
                'a','y','o','ni','pero','entre','sobre','bajo','hasta','desde','hacia','segun',
                'clasific','clasifica','clasifical','agrup','agrupa','grupalo','organiz','analiz','compar',
                'diferenci','diferencia','mostr','muestr','mostram','muestra','lista','listar','ver','verl',
                'descarg','descarga','descargal','descargalo','descargala','genera','imprim','hazlo',
                'dame','dim','pon','quier','quiero','necesit','busco','buscam','busca',
                'enseñ','visualiz','export','filtr','filtram','separa',
                'total','cantidad','son','e','me','mi','tu','su','se','te','nos',
                'este','esta','estos','estas','ese','esa','aquel','aquella',
                'tengo','tien','tiene','tenemos','tienen','ali','aqui','alla','aca',
                'nada','todo','toda','todos','todas','sol','algo','alguno','alguna',
                'favor','porfavor','deme','digame','cuales','puedes','puede','podrias',
                'hay','haber','habia','seran','son','hay'
            ]);

            const rawWords = cleanQuery.split(/[\s¿?.,!;:"]+/).filter(w => w.length >= 2 || /^\d+$/.test(w));
            const baseKeywords = rawWords.map(norm).filter(w => w.length >= 1 && !stopWordsNorm.has(w));

            const keywords = [];
            const expandedSets = [];
            baseKeywords.forEach(kw => {
                const expanded = expandWithSynonyms(kw);
                expanded.forEach(e => { if (!keywords.includes(e)) keywords.push(e); });
                expandedSets.push(expanded);
            });

            function kwMatches(text, kw) {
                if (/^[\d\/]+$/.test(kw)) {
                    return new RegExp(`(^|[^\\d\/])${kw.replace(/\//g,'\\/')}([^\\d\/]|$)`).test(text);
                }
                return text.includes(kw);
            }

            let matchedItems = [];

            if (baseKeywords.length > 0) {
                matchedItems = currentInventoryData.filter(item => {
                    const desc = norm(item.descripcion);
                    const cod  = norm(item.codigo);
                    const loc  = norm(item.ubicacion);
                    return expandedSets.every(group =>
                        group.some(kw => kwMatches(desc, kw) || kwMatches(cod, kw) || kwMatches(loc, kw))
                    );
                });

                if (matchedItems.length === 0 && baseKeywords.length > 0) {
                    const firstExpanded = expandWithSynonyms(baseKeywords[0]);
                    matchedItems = currentInventoryData.filter(item => {
                        const desc = norm(item.descripcion);
                        const cod  = norm(item.codigo);
                        const loc  = norm(item.ubicacion);
                        return firstExpanded.some(kw => kwMatches(desc, kw) || kwMatches(cod, kw) || kwMatches(loc, kw));
                    });
                }

                if (matchedItems.length > 0) {
                    lastMatchedItems = matchedItems;
                    lastKeywords = baseKeywords;
                }
            }

            const needsContext = matchedItems.length === 0 && lastMatchedItems.length > 0;
            if (needsContext) {
                const queryMentionsPrevTopic = lastKeywords.some(kw => qNorm.includes(kw));
                const isFollowUp = INTENTS.classify || INTENTS.analyze || INTENTS.download_pdf ||
                    INTENTS.download_excel || INTENTS.show_table || INTENTS.affirm ||
                    INTENTS.status || INTENTS.location ||
                    queryMentionsPrevTopic || query.trim().length < 12;
                if (isFollowUp) {
                    matchedItems = lastMatchedItems;
                }
            }

            const isAnalyticalQuery = INTENTS.classify || INTENTS.analyze;
            const kwStr      = baseKeywords.length > 0 ? baseKeywords.join(' ') : lastKeywords.join(' ');
            const filterTerm = kwStr.split(' ')[0] || '';
            let factsText = "";
            if (matchedItems.length > 0) {
                const locs   = [...new Set(matchedItems.map(i => i.ubicacion || 'Sin ubicación'))];
                const buenos = matchedItems.filter(i => (i.estado || '').toLowerCase().includes('bueno')).length;
                factsText = `Hay ${matchedItems.length} ítems de "${kwStr}". Ubicaciones: ${locs.join(', ')}. Condición: ${buenos} en buen estado, ${matchedItems.length - buenos} sin especificar.`;
                if (matchedItems.length <= 20) {
                    const detalles = matchedItems.map(i =>
                        `• [${i.codigo}] ${i.descripcion} — Marca: ${i.marca || 'N/A'}, Estado: ${i.estado || 'N/A'}`
                    ).join('\n');
                    factsText += `\nDETALLES POR ÍTEM:\n${detalles}`;
                }
            }

            function buildLocalResponse(items, intent, kwStr, query) {
                if (items.length === 0) {
                    if (intent.greet) {
                        const cats = [...new Set(currentInventoryData.map(i => (i.descripcion||'').split(' ')[0]))].slice(0,8).join(', ');
                        return `¡Hola ${inventariador || 'Bombero'}! 👋 Soy el Cerebro Logístico CIA6.\n\nPuedo ayudarte con:\n  🔍 Búsquedas: "cuántos pitones hay", "busca escaleras"\n  📊 Análisis: "clasifica los tramos", "analiza el inventario"\n  📄 Reportes: "descarga el PDF", "exportar Excel"\n  🗺️ Ubicaciones: "dónde están los cascos"\n\nEquipos disponibles en esta unidad: ${cats}... ¿Qué necesitas? 🚒`;
                    }
                    return null;
                }

                const locs   = [...new Set(items.map(i => i.ubicacion || 'Sin ubicación'))];
                const buenos = items.filter(i => (i.estado||'').toLowerCase().includes('bueno')).length;
                const malos  = items.filter(i => (i.estado||'').toLowerCase().includes('malo')).length;
                const marcas = [...new Set(items.map(i => i.marca || 'N/A'))];

                function normalizeDesc(d) {
                    return (d || '').toUpperCase().trim()
                        .replace(/\s+/g, ' ')
                        .split(' ').map(w => {
                            if (w.length > 4 && w.endsWith('ES') && !w.endsWith('ISES')) return w.slice(0, -2);
                            if (w.length > 3 && w.endsWith('S') && !w.endsWith('SS')) return w.slice(0, -1);
                            return w;
                        }).join(' ');
                }

                const byDesc = {};
                const descLabel = {};
                items.forEach(i => {
                    const key = normalizeDesc(i.descripcion);
                    byDesc[key] = (byDesc[key]||0)+1;
                    if (!descLabel[key]) descLabel[key] = i.descripcion;
                });
                const uniqueTypes = Object.keys(byDesc).length;

                if (intent.classify) {
                    const byMarca = {};
                    items.forEach(i => {
                        const m = i.marca || 'Sin marca';
                        if (!byMarca[m]) byMarca[m] = [];
                        byMarca[m].push(normalizeDesc(i.descripcion));
                    });
                    let resp = `📊 Clasificación de los ${items.length} ítems de "${kwStr}":\n\n`;
                    Object.entries(byMarca).forEach(([marca, descs]) => {
                        const counts = {};
                        descs.forEach(d => { counts[d] = (counts[d]||0)+1; });
                        const lines = Object.entries(counts).map(([d,n]) => `  • ${n}x ${d}`).join('\n');
                        resp += `🔹 Marca ${marca} (${descs.length} unidades):\n${lines}\n\n`;
                    });
                    resp += `📍 Todos en: ${locs.join(', ')} ⚙️`;
                    return resp;
                }

                if (intent.analyze) {
                    let resp = `📈 Análisis de "${kwStr}" — ${items.length} ítems totales:\n`;
                    resp += `  ✅ En buen estado: ${buenos}\n`;
                    resp += `  ⚠️ Mal estado: ${malos}\n`;
                    resp += `  ❓ Sin especificar: ${items.length - buenos - malos}\n`;
                    resp += `  🏷️ Marcas: ${marcas.join(', ')}\n`;
                    resp += `  📍 Ubicación: ${locs.join(', ')}`;
                    return resp;
                }

                if (/donde|ubicacion|estan/.test(query.toLowerCase())) {
                    return `📍 Los ${items.length} ítems de "${kwStr}" están en: **${locs.join(', ')}**. Marcas presentes: ${marcas.join(', ')}. 🚒`;
                }

                if (uniqueTypes === 1) {
                    const [key, count] = Object.entries(byDesc)[0];
                    return `🚒 Hay **${count} unidades** de ${key}. Ubicación: ${locs.join(', ')}. Marcas: ${marcas.join(', ')}.`;
                }

                let resp = `🚒 Encontré **${items.length} ítems** de "${kwStr}" en ${locs.join(', ')} — divididos en ${uniqueTypes} subtipos:\n\n`;
                Object.entries(byDesc)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([key, count]) => {
                        resp += `  🔹 ${count}x ${key}\n`;
                    });
                resp += `\n🏷️ Marcas: ${marcas.join(', ')}. Estado: ${buenos} buenos, ${malos} mal estado, ${items.length-buenos-malos} sin especificar.`;
                return resp;
            }

            try {
                const localResponse = buildLocalResponse(matchedItems, INTENTS, kwStr, query);

                const inventorySummary = `Inventario ${currentUnit}: ${currentInventoryData.length} ítems totales. Inventariador: ${inventariador || 'Bombero'}.`;
                const dataContext      = factsText || (lastMatchedItems.length > 0
                    ? `Contexto previo: ${lastMatchedItems.length} ítems de "${lastKeywords.join(' ')}".`
                    : "Sin contexto de búsqueda activo.");
                const intentContext    = Object.entries(INTENTS).filter(([,v]) => v).map(([k]) => k).join(', ') || 'conversación general';

                const systemPrompt = `Eres "Búsqueda inteligente mediante IA", una IA avanzada de inventario para Bomberos.
INVENTARIO: ${inventorySummary}
DATOS ACTUALES: ${dataContext}
INTENCIÓN DEL USUARIO: ${intentContext}

INSTRUCCIONES ABSOLUTAS:
1. Si la intención es "classify" o "analyze": Agrupa y analiza los DETALLES POR ÍTEM. Da un resumen inteligente por marca/tipo.
2. Si la intención incluye "download_pdf" o "download_excel": Confirma que el archivo fue generado automáticamente.
3. NUNCA muestres los datos en formato crudo. Conviértelos en lenguaje natural analítico.
4. Tono: IA avanzada, profesional, proactivo. Emojis precisos (🚒⚙️📊).
5. Responde en español. Conciso pero rico en información.`;

                chatHistory.push({ role: 'user', content: query });
                if (chatHistory.length > 20) chatHistory.shift();

                let finalText = localResponse;
                try {
                    const controller = new AbortController();
                    const timeoutId  = setTimeout(() => controller.abort(), 8000);

                    const response = await fetch('https://text.pollinations.ai/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messages: [
                                { role: 'system', content: systemPrompt },
                                ...chatHistory
                            ],
                            model: 'openai',
                            private: true
                        }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const rawText   = await response.text();
                        const cloudText = rawText
                            .replace(/⚠️[\s\S]*?normally\./gi, '')
                            .replace(/---[\s\S]*?Support Pollinations[\s\S]*$/gi, '')
                            .replace(/\*\*Support Pollinations[\s\S]*/gi, '')
                            .replace(/\*\*Ad\*\*[\s\S]*/gi, '')
                            .replace(/🌸[\s\S]*?pollinations[\s\S]*/gi, '')
                            .replace(/Powered by Pollinations[\s\S]*/gi, '')
                            .replace(/\[Support our mission\][\s\S]*/gi, '')
                            .replace(/pollinations\.ai[\s\S]*/gi, '')
                            .trim();
                        if (cloudText && cloudText.length > 20 
                            && !cloudText.toLowerCase().includes('no tengo información')
                            && !cloudText.toLowerCase().includes('pollinations')) {
                            finalText = cloudText;
                        }
                    }
                } catch (_) {
                    console.log("Cloud AI unavailable — using local intelligence.");
                }

                if (!finalText) {
                    finalText = matchedItems.length === 0
                        ? "🔍 No encontré ítems con ese criterio. Prueba con otro término (ej: 'manguera', 'hacha', 'piton')."
                        : `📋 ${matchedItems.length} ítems encontrados de "${kwStr}" en ${[...new Set(matchedItems.map(i=>i.ubicacion))].join(', ')}.`;
                }

                typingDiv.remove();
                chatHistory.push({ role: 'assistant', content: finalText });

                if (matchedItems.length > 0) {
                    if (INTENTS.download_pdf) await downloadFilteredPDF(matchedItems, kwStr || 'inventario');
                    if (INTENTS.download_excel) downloadFilteredExcel(matchedItems, kwStr || 'inventario');
                    if (INTENTS.show_table) filterTableWith(filterTerm);
                }

                const actions = matchedItems.length > 0 ? [
                    { label: '📋 Ver en Tabla', handler: () => filterTableWith(filterTerm) },
                    { label: '📄 PDF',          handler: () => downloadFilteredPDF(matchedItems, kwStr) },
                    { label: '📊 Excel',         handler: () => downloadFilteredExcel(matchedItems, kwStr) }
                ] : [
                    { label: '🔄 Ver Todo', handler: () => filterTableWith('') }
                ];

                addMessage(finalText.replace(/\n/g, '<br>'), 'assistant', actions);

            } catch (err) {
                console.error("AI Error:", err);
                typingDiv.remove();
                const msg = factsText
                    ? `🚨 Núcleo de lenguaje con latencia. Datos recuperados: ${factsText}`
                    : "🚒 Error de conexión. Intenta con una búsqueda directa.";
                addMessage(msg, 'assistant');
            }
        }

        sendAi.addEventListener('click', () => {
            const text = aiInput.value.trim();
            if (!text) return;
            addMessage(text, 'user');
            aiInput.value = '';

            const multiPattern = /\s+y\s+(?=(cuant\w*|donde|busca)\s+\w+)/i;
            const subQueries = text.split(multiPattern).map(s => s.trim()).filter(s => s.length > 3);
            
            if (subQueries.length > 1) {
                (async () => {
                    for (const sq of subQueries) {
                        await processAiQuery(sq);
                    }
                })();
            } else {
                processAiQuery(text);
            }
        });

        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAi.click();
        });
    }

    checkSession(); // Added to trigger auth check on load

}); // End of DOMContentLoaded
