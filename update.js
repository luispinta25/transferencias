const supabaseUrl = 'https://lpsupabase.ferrisoluciones.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.mKBTuXoyxw3lXRGl1VpSlGbSeiMnRardlIx1q5n-o0k';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const urlParams = new URLSearchParams(window.location.search);
const idVenta = urlParams.get('v');

const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const formCard = document.getElementById('update-form-card');
const montoInput = document.getElementById('monto');
const motivoInput = document.getElementById('motivo');

let currentTransferencia = null;
let currentUser = null;
let currentPhoto = null;

// Inicialización
// Inicialización
async function init() {
    await checkAuth();
    if (idVenta) {
        loadTransferencia();
    } else {
        showError('No se proporcionó un ID de venta válido.');
    }

    // Fix: Mostrar el cuerpo de la página eliminando la opacidad
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Intentar obtener datos del usuario para mostrar nombre (opcional)
    const { data: userData } = await supabaseClient
        .from('usuarios_ferreteria')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    const displayElement = document.getElementById('user-display');
    if (userData) {
        displayElement.textContent = userData.nombres + ' ' + userData.apellidos;
    } else {
        displayElement.textContent = currentUser.email;
    }
}

async function loadTransferencia() {
    try {
        const { data, error } = await supabaseClient
            .from('transferencias')
            .select('*')
            .eq('id_venta', idVenta)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            showError('No se encontró ninguna transferencia con este ID de venta.');
            return;
        }

        currentTransferencia = data;
        renderTransferencia(data);

    } catch (error) {
        console.error('Error al cargar transferencia:', error);
        showError('Error al cargar los datos: ' + error.message);
    }
}

function renderTransferencia(data) {
    loading.style.display = 'none';
    formCard.style.display = 'block';

    montoInput.value = data.monto;
    motivoInput.value = data.motivo;

    // Si ya existe foto, podríamos mostrarla o advertir, pero el requisito es actualizar
    if (data.fotografia) {
        showMessage('Este registro ya tiene una fotografía. Al guardar se reemplazará.', 'info');
    }
}

function showError(msg) {
    loading.style.display = 'none';
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
    formCard.style.display = 'none';
}

function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'alert alert-' + type;
    messageDiv.style.cssText =
        'position: fixed;' +
        'top: 80px;' +
        'right: 20px;' +
        'padding: 15px 20px;' +
        'background: ' + (type === 'success' ? '#4CAF50' : (type === 'info' ? '#2196F3' : '#f44336')) + ';' +
        'color: white;' +
        'border-radius: 8px;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
        'z-index: 1000;' +
        'animation: slideIn 0.3s ease-out;';
    messageDiv.textContent = text;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageDiv.remove(), 300);
    }, 4000);
}

// --- Manejo de Fotos (Reutilizado de app.js) ---
const btnCamara = document.getElementById('btn-camara');
const btnGaleria = document.getElementById('btn-galeria');
const fotoPreview = document.getElementById('foto-preview');
const previewImg = document.getElementById('preview-img');
const previewFilename = document.getElementById('preview-filename');

function selectPhoto({ capture } = {}) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (capture) input.setAttribute('capture', capture);
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
        input.addEventListener('cancel', () => resolve(null), { once: true });

        input.click();
    });
}

async function handlePhotoSelection(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewFilename.textContent = file.name;
        fotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);

    try {
        currentPhoto = await compressImageIfNeeded(file);
        previewFilename.textContent = `${file.name} → ${(currentPhoto.size / 1024 / 1024).toFixed(2)}MB`;
    } catch (error) {
        console.error('Error compresión:', error);
        currentPhoto = file;
    }
}

// Copiada de app.js (versión simplificada)
async function compressImageIfNeeded(file, maxSizeMB = 1) {
    if (file.size <= maxSizeMB * 1024 * 1024) return file;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width, height = img.height;
                const maxDim = 1920;

                if (width > maxDim || height > maxDim) {
                    if (width > height) { height = Math.round((height / width) * maxDim); width = maxDim; }
                    else { width = Math.round((width / height) * maxDim); height = maxDim; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.7);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

btnCamara.addEventListener('click', async () => {
    const file = await selectPhoto({ capture: 'environment' });
    handlePhotoSelection(file);
});

btnGaleria.addEventListener('click', async () => {
    const file = await selectPhoto();
    handlePhotoSelection(file);
});

// --- Subida y Actualización ---

async function uploadPhotoToWebhook(file, motivo) {
    const formData = new FormData();
    const ahora = new Date();
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const path = `/FERRESOLUCIONES/TRANSFERENCIAS/${meses[ahora.getMonth()]}/`;
    const filename = `${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}_${motivo.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_')}.PNG`;

    formData.append('file', new File([file], filename, { type: file.type }));
    formData.append('path', path);
    formData.append('filename', filename);

    const response = await fetch('https://webhookn8n.ferrisoluciones.com/webhook/87f1603e-86ad-4547-8a87-a5d9f9b02115', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Error al subir foto');

    const data = await response.json();
    return (Array.isArray(data) && data[0]?.finalurl) ? data[0].finalurl : (data.finalurl || data.url);
}

document.getElementById('update-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPhoto) {
        showMessage('Debes seleccionar una foto', 'error');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        // 1. Subir Foto
        const fotoUrl = await uploadPhotoToWebhook(currentPhoto, currentTransferencia.motivo);

        // 2. Actualizar Supabase
        const { error } = await supabaseClient
            .from('transferencias')
            .update({
                fotografia: fotoUrl,
                user_id: currentUser.id,
                subido_por: currentUser.email,
                // created_at podría actualizarse si se requiere tracking de fecha de actualización real
            })
            .eq('id', currentTransferencia.id);

        if (error) throw error;

        // 3. Notificar Webhook
        await fetch('https://webhookn8n.ferrisoluciones.com/webhook/notificacion_actualizacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo: 'actualizacion_transferencia',
                id_venta: idVenta,
                monto: currentTransferencia.monto,
                motivo: currentTransferencia.motivo,
                usuario: currentUser.email,
                foto_url: fotoUrl,
                id_message: currentTransferencia.id_message,
                mensaje: `Transferencia actualizada por ${currentUser.email}. ID Venta: ${idVenta}`
            })
        });

        showMessage('Actualización exitosa', 'success');
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        console.error(error);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar y Enviar';
    }
});

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

init();
