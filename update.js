const supabaseUrl = 'https://lpsupabase.luispintasolutions.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.LJEZ3yyGRxLBmCKM9z3EW-Yla1SszwbmvQMngMe3IWA';
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
        // 1. Intentar buscar en transferencias (por si ya existe registro parcial)
        let { data, error } = await supabaseClient
            .from('ferre_transferencias')
            .select('*')
            .eq('id_venta', idVenta)
            .maybeSingle();

        if (error) throw error;

        // 2. Si no existe en transferencias, buscar en la tabla de ventas original
        if (!data) {
            console.log('No encontrado en transferencias, buscando en ferre_ventas...');
            const { data: ventaData, error: ventaError } = await supabaseClient
                .from('ferre_ventas')
                .select('*')
                .eq('id_venta', idVenta)
                .maybeSingle();

            if (ventaError) throw ventaError;

            if (ventaData) {
                // Mapear datos de la venta al formato de transferencia
                data = {
                    id_venta: ventaData.id_venta,
                    monto: ventaData.total,
                    motivo: `Pago de venta ${ventaData.id_venta}`,
                    caso: 'ingreso', // Por defecto las ventas son ingresos
                    isNew: true // Flag para saber que debemos insertar en lugar de actualizar
                };
            }
        }

        if (!data) {
            showError(`El ID de venta ${idVenta} no existe en transferencias ni en ventas.`);
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

    // Bloquear si ya existe fotografía
    if (data.fotografia) {
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
        if (fotoPreview && previewImg) {
            previewImg.src = data.fotografia;
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

btnCamara.addEventListener('click', async () => {
    const file = await selectPhoto({ capture: 'environment' });
    handlePhotoSelection(file);
});

btnGaleria.addEventListener('click', async () => {
    const file = await selectPhoto();
    handlePhotoSelection(file);
});

function construirMensajeActualizacionVenta({ idVenta, monto, motivo }) {
    const montoFormateado = Number.parseFloat(monto || 0).toFixed(2);
    const partes = [
        '✅ *La venta ha sido actualizada correctamente.*',
        '',
        `💵 *Monto:* $${montoFormateado}`
    ];

    if (idVenta) {
        partes.push(`🧾 *Venta:* ${idVenta}`);
    }

    if ((motivo || '').trim()) {
        partes.push(`📝 *Motivo:* ${(motivo || '').trim()}`);
    }

    partes.push('', '📸 *Comprobante actualizado*');

    return partes.join('\n');
}

// Función para subir foto a Supabase Bucket y notificar a n8n
async function uploadPhotoToSupabase(file, motivo, originalMessageId = null) {
    try {
        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const hora = String(ahora.getHours()).padStart(2, '0') + String(ahora.getMinutes()).padStart(2, '0');
        const seg = String(ahora.getSeconds()).padStart(2, '0');

        const datosActualizacion = typeof motivo === 'object' && motivo !== null
            ? motivo
            : { motivo };
        const motivoTexto = (datosActualizacion.motivo || '').trim();
        const captionAmigable = construirMensajeActualizacionVenta(datosActualizacion);
        const motivoLimpio = (motivoTexto || 'UPDATE').substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        // Generar un nombre único con segundos para evitar colisiones
        const filename = `${dia}_${hora}${seg}_${motivoLimpio}.webp`;

        const path = `transferencias/${filename}`;

        console.log('Subiendo a Supabase:', path);

        // Subir al bucket 'ferrisoluciones'
        const { data: uploadData, error: uploadError } = await supabaseClient
            .storage
            .from('ferrisoluciones')
            .upload(path, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Error al subir a Supabase:', uploadError);
            throw uploadError;
        }

        // Obtener la URL pública
        const { data: { publicUrl } } = supabaseClient
            .storage
            .from('ferrisoluciones')
            .getPublicUrl(path);

        console.log('URL pública generada:', publicUrl);

        // Enviar al nuevo webhook de n8n
        let messageId = null;
        try {
            const webhookResponse = await fetch('https://lpn8nwebhook.luispintasolutions.com/webhook/a93e51ea-2752-4a11-9190-49460bb0745f', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: publicUrl,
                    filename: filename,
                    motivo: motivoTexto,
                    monto: datosActualizacion.monto || null,
                    id_venta: datosActualizacion.idVenta || null,
                    mensaje: captionAmigable,
                    caption: captionAmigable,
                    transferencia_id: Date.now(),
                    id_message_original: originalMessageId, // Incluimos el ID original si existe
                    tipo: 'subida_directa_supabase_update',
                    fecha: ahora.toISOString()
                })
            });
            console.log('Notificación enviada a n8n:', webhookResponse.status);

            if (webhookResponse.ok) {
                const dataResponse = await webhookResponse.json();
                if (Array.isArray(dataResponse) && dataResponse.length > 0) {
                    messageId = dataResponse[0].data?.key?.id;
                } else if (dataResponse.data?.key?.id) {
                    messageId = dataResponse.data.key.id;
                }
                if (messageId) console.log('MessageId capturado desde n8n:', messageId);
            }
        } catch (webhookErr) {
            console.warn('Error al enviar notificación a n8n, pero la subida fue exitosa:', webhookErr);
        }

        return { publicUrl, messageId };
    } catch (error) {
        console.error('Error en uploadPhotoToSupabase:', error);
        throw error;
    }
}
async function uploadPhotoToWebhook(file, motivo, originalMessageId = null) {
    return await uploadPhotoToSupabase(file, motivo, originalMessageId);
}

document.getElementById('update-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentTransferencia && currentTransferencia.fotografia) {
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
        // 1. Subir Foto (Pasamos el ID de mensaje original si existe)
        const resultUpload = await uploadPhotoToSupabase(
            currentPhoto, 
            {
                motivo: currentTransferencia.motivo,
                monto: currentTransferencia.monto,
                idVenta: idVenta
            }, 
            currentTransferencia.id_message
        );
        const fotoUrl = resultUpload.publicUrl;
        const msgId = resultUpload.messageId;

        // 2. Actualizar o Insertar en Supabase
        let result;
        if (currentTransferencia.isNew) {
            // Si es nuevo, insertamos
            result = await supabaseClient
                .from('ferre_transferencias')
                .insert([{
                    id_venta: idVenta,
                    monto: currentTransferencia.monto,
                    motivo: currentTransferencia.motivo,
                    caso: 'ingreso',
                    fotografia: fotoUrl,
                    user_id: currentUser.id,
                    subido_por: currentUser.email,
                    id_message: msgId
                }]);
        } else {
            // Si ya existe, actualizamos
            const updateData = {
                fotografia: fotoUrl,
                user_id: currentUser.id,
                subido_por: currentUser.email,
            };
            
            // Si el webhook devolvió un nuevo ID de mensaje, lo actualizamos también
            if (msgId) {
                updateData.id_message = msgId;
            }

            result = await supabaseClient
                .from('ferre_transferencias')
                .update(updateData)
                .eq('id', currentTransferencia.id);
        }

        if (result.error) throw result.error;

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
