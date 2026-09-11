const supabaseUrl = 'https://lpsupabase.luispintasolutions.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.LJEZ3yyGRxLBmCKM9z3EW-Yla1SszwbmvQMngMe3IWA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
// La sesión de Supabase Auth sigue siendo la identidad (login real, no el
// código de 6 dígitos que había antes). Todo lo demás -- leer el registro,
// subir la foto, avisar por WhatsApp -- ya NO habla directo con Supabase:
// pasa por el backend (api-pos), que valida la sesión, no deja sobreescribir
// un comprobante ya subido y sube la foto con su propia clave de servicio.
const API_BASE = 'https://api.ferrisoluciones.com/api/transfer-proof';

const urlParams = new URLSearchParams(window.location.search);
const idVenta = urlParams.get('v');

const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const formCard = document.getElementById('update-form-card');
const montoInput = document.getElementById('monto');
const motivoInput = document.getElementById('motivo');
const tipoTexto = document.getElementById('tipo-movimiento-texto');

let currentTransferencia = null;
let currentUser = null;
let currentPhoto = null;

async function apiRequest(path, options = {}) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Sesión no disponible.');
    const response = await fetch(API_BASE + path, {
        ...options,
        headers: {
            Authorization: 'Bearer ' + token,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const raw = await response.text();
    let body = null;
    if (raw) {
        try { body = JSON.parse(raw); } catch (_) { body = { raw }; }
    }
    if (!response.ok) throw new Error(body?.error || `Error ${response.status}`);
    return body;
}

// Inicialización
async function init() {
    await checkAuth();
    if (idVenta) {
        loadTransferencia();
    } else {
        showError('No se proporcionó un código de transferencia válido.');
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
    const { data: userData, error } = await supabaseClient
        .from('ferre_usuarios_ferreteria')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (error && (error.code === 'PGRST301' || error.message?.includes('JWT'))) {
        await supabaseClient.auth.signOut();
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    const displayElement = document.getElementById('user-display');
    if (userData) {
        displayElement.textContent = userData.nombres + ' ' + userData.apellidos;
    } else {
        displayElement.textContent = currentUser.email;
    }
}

async function loadTransferencia() {
    try {
        const response = await apiRequest('/' + encodeURIComponent(idVenta), { method: 'GET' });
        currentTransferencia = response.data;
        renderTransferencia(currentTransferencia);
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

    const esEgreso = String(data.caso).toLowerCase() === 'egreso';
    tipoTexto.textContent = data.tipo_etiqueta || (esEgreso ? 'Egreso' : 'Ingreso');
    document.getElementById('tipo-movimiento-icon').className =
        'fas ' + (esEgreso ? 'fa-arrow-down' : 'fa-arrow-up');

    // Bloquear si ya existe fotografía
    if (data.tiene_foto) {
        showMessage('Este registro ya cuenta con un comprobante. No se permiten actualizaciones.', 'error');
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-lock"></i> Registro Bloqueado';

        // También ocultamos los botones de foto para evitar confusión
        const fotoButtons = document.querySelector('.foto-buttons');
        if (fotoButtons) fotoButtons.style.display = 'none';

        // Mostrar la foto actual
        const fotoPreview = document.getElementById('foto-preview');
        const previewImg = document.getElementById('preview-img');
        const previewFilename = document.getElementById('preview-filename');
        if (fotoPreview && previewImg && data.foto_url) {
            previewImg.src = data.foto_url;
            previewFilename.textContent = 'Comprobante ya registrado';
            fotoPreview.style.display = 'flex';
        }
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

// --- Manejo de Fotos ---
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
        currentPhoto = await compressImageToWebP(file);
        previewFilename.textContent = `${file.name} (WebP) → ${(currentPhoto.size / 1024 / 1024).toFixed(2)}MB`;
    } catch (error) {
        console.error('Error compresión:', error);
        currentPhoto = file;
    }
}

// Función para convertir a WebP (80% calidad)
async function compressImageToWebP(file, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = (error) => {
            reject(error);
        };

        reader.onload = (event) => {
            const img = new Image();

            img.onerror = (error) => {
                reject(error);
            };

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Reducir dimensiones si son muy grandes (max 1920px)
                const maxDimension = 1920;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height / width) * maxDimension);
                        width = maxDimension;
                    } else {
                        width = Math.round((width / height) * maxDimension);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('No se pudo comprimir la imagen'));
                            return;
                        }

                        const webpFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: 'image/webp',
                            lastModified: Date.now()
                        });

                        resolve(webpFile);
                    },
                    'image/webp',
                    quality
                );
            };

            img.src = event.target.result;
        };

        reader.readAsDataURL(file);
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
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

document.getElementById('update-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentTransferencia && currentTransferencia.tiene_foto) {
        showMessage('Este registro ya tiene un comprobante y no puede ser modificado.', 'error');
        return;
    }

    if (!currentPhoto) {
        showMessage('Debes seleccionar una foto', 'error');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        const dataUrl = await fileToDataUrl(currentPhoto);
        await apiRequest('/' + encodeURIComponent(idVenta), {
            method: 'POST',
            body: JSON.stringify({
                dataUrl,
                mimetype: currentPhoto.type || 'image/webp',
                fileName: currentPhoto.name
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
