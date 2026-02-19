const supabaseUrl = 'https://lpsupabase.luispintasolutions.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.LJEZ3yyGRxLBmCKM9z3EW-Yla1SszwbmvQMngMe3IWA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Lógica de Redirección y Bloqueo ---
const urlParams = new URLSearchParams(window.location.search);
const ventaParam = urlParams.get('v');

if (ventaParam) {
    // Si existe el parámetro v, redirigir al modo actualización
    window.location.href = `update.html?v=${ventaParam}`;
} else {
    // Si NO existe el parámetro, activar bloqueo de Modo Directo
    document.addEventListener('DOMContentLoaded', () => {
        const modalVerificacion = document.getElementById('modal-verificacion');
        // Mostrar modal y bloquear cierre (no tiene botón de cerrar ni cierra al click fuera)
        modalVerificacion.style.display = 'flex';
        modalVerificacion.style.alignItems = 'center';
        modalVerificacion.style.justifyContent = 'center';

        const btnSolicitar = document.getElementById('btn-solicitar-codigo');
        const btnVerificar = document.getElementById('btn-verificar-codigo');
        const inputCodigo = document.getElementById('codigo-verificacion');
        const msgVerificacion = document.getElementById('msg-verificacion');

        // Generar código aleatorio de 6 caracteres
        function generarCodigo() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let codigo = '';
            for (let i = 0; i < 6; i++) {
                codigo += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return codigo;
        }

        let codigoGenerado = null;

        btnSolicitar.addEventListener('click', async () => {
            btnSolicitar.disabled = true;
            btnSolicitar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Solicitando...';
            msgVerificacion.textContent = '';
            msgVerificacion.style.color = '#333';

            try {
                codigoGenerado = generarCodigo();
                console.log('Código generado (para debug):', codigoGenerado);

                // Enviar webhook con el código
                const response = await fetch('https://webhookn8n.ferrisoluciones.com/webhook/codigo', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tipo: 'solicitud_acceso_directo',
                        codigo: codigoGenerado,
                        fecha: new Date().toISOString()
                    })
                });

                if (response.ok) {
                    msgVerificacion.textContent = 'Código enviado correctamente. Revise su notficación.';
                    msgVerificacion.style.color = 'green';
                } else {
                    throw new Error('Error al enviar código');
                }
            } catch (error) {
                console.error('Error:', error);
                msgVerificacion.textContent = 'Error al solicitar código. Intente nuevamente.';
                msgVerificacion.style.color = 'red';
            } finally {
                btnSolicitar.disabled = false;
                btnSolicitar.innerHTML = '<i class="fas fa-key"></i> Solicitar Nuevo Código';
            }
        });

        btnVerificar.addEventListener('click', () => {
            const codigoIngresado = inputCodigo.value.toUpperCase().trim();

            // Backdoor estático temporal o lógica solo con código generado
            if (codigoGenerado && codigoIngresado === codigoGenerado) {
                modalVerificacion.style.display = 'none';
                showMessage('Modo Directo Activado', 'success');
            } else {
                msgVerificacion.textContent = 'Código incorrecto.';
                msgVerificacion.style.color = 'red';
                inputCodigo.classList.add('campo-error');
                setTimeout(() => inputCodigo.classList.remove('campo-error'), 1000);
            }
        });
    });
}

let currentUser = null;
let currentUserData = null;
let allTransferencias = [];

const tbody = document.getElementById('transferencias-tbody');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');
const filterCaso = document.getElementById('filter-caso');
const saldoCard = document.querySelector('.saldo-card');
const filtersCard = document.querySelector('.filters-card');

function setupViewFromCache() {
    const cachedRole = localStorage.getItem('userRole');
    const cachedNombres = localStorage.getItem('userNombres');
    const cachedApellidos = localStorage.getItem('userApellidos');

    if (cachedRole) {
        if (cachedNombres && cachedApellidos) {
            document.getElementById('user-email').textContent = cachedNombres + ' ' + cachedApellidos;
        }

        const formCard = document.querySelector('.form-card');
        const statsGrid = document.querySelector('.stats-grid');
        const container = document.querySelector('.container');

        if (cachedRole === 'admin' || cachedRole === 'contador') {
            saldoCard.style.display = 'block';
            filtersCard.style.display = 'flex';
        } else {
            saldoCard.style.display = 'none';
            filtersCard.style.display = 'none';
            container.insertBefore(formCard, container.firstChild);
            document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Movimiento del Día';
            statsGrid.style.marginTop = '30px';
        }
    }

    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userNombres');
        localStorage.removeItem('userApellidos');
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    const { data: userData, error } = await supabaseClient
        .from('ferre_usuarios_ferreteria')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

    if (error) {
        console.error('Error al cargar usuario:', error);
        // Si el token no es válido para el nuevo servidor, forzar logout
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
            await supabaseClient.auth.signOut();
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
    }

    if (userData) {
        currentUserData = userData;
        localStorage.setItem('userRole', userData.rol);
        localStorage.setItem('userNombres', userData.nombres);
        localStorage.setItem('userApellidos', userData.apellidos);
        document.getElementById('user-email').textContent = userData.nombres + ' ' + userData.apellidos;
        setupViewByRole(userData.rol);
    } else {
        localStorage.setItem('userRole', 'usuario');
        document.getElementById('user-email').textContent = currentUser.email;
        setupViewByRole('usuario');
    }
}

function setupViewByRole(rol) {
    const formCard = document.querySelector('.form-card');
    const statsGrid = document.querySelector('.stats-grid');
    const container = document.querySelector('.container');

    if (rol === 'admin' || rol === 'contador') {
        saldoCard.style.display = 'block';
        filtersCard.style.display = 'flex';
        loadSaldo();
        loadTransferencias();
    } else {
        saldoCard.style.display = 'none';
        filtersCard.style.display = 'none';
        container.insertBefore(formCard, container.firstChild);
        document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar nueva transferencia';
        statsGrid.style.marginTop = '30px';
        loadTransferenciasDelDia();
    }
}

async function loadSaldo() {
    try {
        const { data, error } = await supabaseClient
            .from('ferre_saldo_actual')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        if (data) {
            document.getElementById('saldo-total').textContent =
                '$' + parseFloat(data.monto_total || 0).toFixed(2);

            const fecha = new Date(data.ultima_actualizacion);
            document.getElementById('ultima-actualizacion').textContent =
                fecha.toLocaleString('es-ES');
        }
    } catch (error) {
        console.error('Error al cargar saldo:', error);
    }
}

async function enrichTransferenciasWithNames(transferencias) {
    if (!transferencias || transferencias.length === 0) return transferencias;

    const emails = [...new Set(transferencias.map(t => t.subido_por).filter(e => e))];
    if (emails.length === 0) return transferencias;

    const { data: usuarios, error } = await supabaseClient
        .from('ferre_usuarios_ferreteria')
        .select('email, nombres, apellidos')
        .in('email', emails);

    if (error) {
        console.error('Error al cargar nombres de usuarios:', error);
        return transferencias;
    }

    const emailToName = {};
    if (usuarios) {
        usuarios.forEach(u => {
            emailToName[u.email] = u.nombres + ' ' + u.apellidos;
        });
    }

    return transferencias.map(t => ({
        ...t,
        subido_por_nombre: emailToName[t.subido_por] || t.subido_por || 'N/A'
    }));
}

async function loadTransferencias() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';

    try {
        const { data, error } = await supabaseClient
            .from('ferre_transferencias')
            .select('*')
            .order('fechahora', { ascending: false });

        if (error) throw error;

        allTransferencias = await enrichTransferenciasWithNames(data || []);
        calculateStats(allTransferencias);
        renderTransferencias(allTransferencias);

    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Error al cargar transferencias: ' + error.message;
        errorMessage.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function loadTransferenciasDelDia() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';

    try {
        const ahora = new Date();
        const ecuadorOffset = -5 * 60;
        const localOffset = ahora.getTimezoneOffset();
        const diferenciaMinutos = ecuadorOffset - localOffset;
        const fechaEcuador = new Date(ahora.getTime() + diferenciaMinutos * 60000);
        fechaEcuador.setHours(0, 0, 0, 0);
        const inicioDia = fechaEcuador.toISOString();

        const { data, error } = await supabaseClient
            .from('ferre_transferencias')
            .select('*')
            .gte('fechahora', inicioDia)
            .order('fechahora', { ascending: false });

        if (error) throw error;

        allTransferencias = await enrichTransferenciasWithNames(data || []);
        calculateStatsDelDia(allTransferencias);
        renderTransferencias(allTransferencias);

    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Error al cargar transferencias: ' + error.message;
        errorMessage.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function calculateStats(data) {
    const totalIngresos = data
        .filter(t => t.caso === 'ingreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);

    const totalEgresos = data
        .filter(t => t.caso === 'egreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);

    document.getElementById('total-ingresos').textContent = '$' + totalIngresos.toFixed(2);
    document.getElementById('total-egresos').textContent = '$' + totalEgresos.toFixed(2);
    document.getElementById('total-transacciones').textContent = data.length;
}

function calculateStatsDelDia(data) {
    const totalIngresos = data
        .filter(t => t.caso === 'ingreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);

    const totalEgresos = data
        .filter(t => t.caso === 'egreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);

    const fechaHoy = new Date();
    const opciones = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' };
    const fechaFormateada = fechaHoy.toLocaleDateString('es-EC', opciones);

    document.querySelector('.stat-card.ingreso .stat-label').innerHTML =
        '<i class="fas fa-calendar-day"></i> Ingresos de Hoy<br><small style="font-size: 0.75em; opacity: 0.8;">' + fechaFormateada + '</small>';
    document.querySelector('.stat-card.egreso .stat-label').innerHTML =
        '<i class="fas fa-calendar-day"></i> Egresos de Hoy<br><small style="font-size: 0.75em; opacity: 0.8;">' + fechaFormateada + '</small>';
    document.querySelector('.stat-card.total').style.display = 'none';

    document.getElementById('total-ingresos').textContent = '$' + totalIngresos.toFixed(2);
    document.getElementById('total-egresos').textContent = '$' + totalEgresos.toFixed(2);
}

function renderTransferencias(data) {
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">No hay transferencias registradas</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((t, index) => {
        const fecha = new Date(t.fechahora);
        const fechaFormato = fecha.toLocaleDateString('es-ES');
        const horaFormato = fecha.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const badgeIcon = t.caso === 'ingreso' ?
            '<i class="fas fa-arrow-up"></i> Ingreso' :
            '<i class="fas fa-arrow-down"></i> Egreso';

        const signo = t.caso === 'ingreso' ? '+' : '-';

        return '<tr class="transferencia-row" data-index="' + index + '" style="cursor: pointer;">' +
            '<td><div style="font-weight: 600;">' + fechaFormato + '</div><div style="font-size: 0.9em; color: #666;">' + horaFormato + '</div></td>' +
            '<td><span class="badge badge-' + t.caso + '">' + badgeIcon + '</span></td>' +
            '<td class="monto-' + t.caso + '">' + signo + '$' + parseFloat(t.monto).toFixed(2) + '</td>' +
            '<td>' + t.motivo + '</td>' +
            '<td><div style="font-size: 0.9em;"><i class="fas fa-user"></i> ' + (t.subido_por_nombre || t.subido_por || 'N/A') + '</div></td>' +
            '</tr>';
    }).join('');

    document.querySelectorAll('.transferencia-row').forEach(row => {
        row.addEventListener('click', () => {
            const index = parseInt(row.dataset.index);
            mostrarModal(data[index]);
        });
    });
}

function filterTransferencias() {
    const searchTerm = searchInput.value.toLowerCase();
    const casoFilter = filterCaso.value;

    const filtered = allTransferencias.filter(t => {
        const matchesSearch = t.motivo.toLowerCase().includes(searchTerm);
        const matchesCaso = !casoFilter || t.caso === casoFilter;
        return matchesSearch && matchesCaso;
    });

    renderTransferencias(filtered);
}

document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        document.getElementById('caso').value = this.dataset.tipo;
    });
});

let currentPhoto = null;

const btnCamara = document.getElementById('btn-camara');
const btnGaleria = document.getElementById('btn-galeria');
const fotoPreview = document.getElementById('foto-preview');
const previewImg = document.getElementById('preview-img');
const previewFilename = document.getElementById('preview-filename');

// Modal de confirmación personalizado
const confirmModal = document.getElementById('confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmCancelBtn = document.getElementById('confirm-cancel');

// Función para mostrar modal de confirmación personalizado
function showConfirmModal(message) {
    return new Promise((resolve) => {
        const confirmBody = document.querySelector('.confirm-body');
        confirmBody.textContent = message;
        confirmModal.style.display = 'block';

        confirmYesBtn.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(true);
        };

        confirmCancelBtn.onclick = () => {
            confirmModal.style.display = 'none';
            resolve(false);
        };

        // Cerrar al hacer clic fuera del modal
        confirmModal.onclick = (e) => {
            if (e.target === confirmModal) {
                confirmModal.style.display = 'none';
                resolve(false);
            }
        };
    });
}

// Función para confirmar cambio de foto
async function confirmarCambioFoto() {
    if (currentPhoto) {
        return await showConfirmModal('¿Cambiar la foto actual? Se perderá la imagen seleccionada.');
    }
    return true;
}

function selectPhoto({ capture } = {}) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (capture) {
            input.setAttribute('capture', capture);
        }
        input.style.display = 'none';
        document.body.appendChild(input);

        let resolved = false;
        const cleanup = () => {
            if (input.parentNode) {
                document.body.removeChild(input);
            }
        };

        const finish = (file) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve(file || null);
        };

        input.addEventListener('change', () => {
            const file = input.files && input.files[0] ? input.files[0] : null;
            finish(file);
        }, { once: true });

        input.addEventListener('cancel', () => {
            finish(null);
        }, { once: true });

        input.click();
    });
}

// Botón cámara
btnCamara.addEventListener('click', async () => {
    if (!(await confirmarCambioFoto())) {
        return;
    }
    const file = await selectPhoto({ capture: 'environment' });
    if (file) {
        handlePhotoSelection(file);
    }
});

// Botón galería
btnGaleria.addEventListener('click', async () => {
    if (!(await confirmarCambioFoto())) {
        return;
    }
    const file = await selectPhoto();
    if (file) {
        handlePhotoSelection(file);
    }
});

// Manejar selección de foto (cámara o galería)
async function handlePhotoSelection(file) {
    if (!file) return;

    // Mostrar preview del archivo original
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewFilename.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`;
        fotoPreview.style.display = 'flex';
    };
    reader.readAsDataURL(file);

    // Comprimir en segundo plano
    try {
        const compressedFile = await compressImageToWebP(file);
        currentPhoto = compressedFile;

        // Actualizar el nombre del archivo en el preview con el tamaño comprimido
        previewFilename.textContent = `${file.name} (WebP) → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`;
    } catch (error) {
        console.error('Error al comprimir:', error);
        currentPhoto = file;
    }
}

// Entradas dinámicas manejan la selección, no se necesitan listeners directos

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

// Función para subir foto a Supabase Bucket y notificar a n8n
async function uploadPhotoToSupabase(file, motivo, originalMessageId = null) {
    try {
        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const hora = String(ahora.getHours()).padStart(2, '0') + String(ahora.getMinutes()).padStart(2, '0');
        const seg = String(ahora.getSeconds()).padStart(2, '0');

        const motivoLimpio = motivo.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
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
                    motivo: motivo,
                    transferencia_id: Date.now(), // ID temporal para rastreo
                    id_message_original: originalMessageId, // Incluimos el ID original si existe
                    tipo: 'subida_directa_supabase',
                    fecha: ahora.toISOString()
                })
            });
            console.log('Notificación enviada a n8n:', webhookResponse.status);
            
            if (webhookResponse.ok) {
                const dataResponse = await webhookResponse.json();
                // Extraer el id de la estructura proporcionada por el usuario
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


// Función para validar campos y mostrar errores
function validarCampos() {
    let camposVacios = [];

    // Obtener elementos
    const montoInput = document.getElementById('monto');
    const motivoInput = document.getElementById('motivo');
    const fotoButtonsDiv = document.querySelector('.foto-buttons');

    // Remover clases de error previas
    document.querySelectorAll('.campo-error, .campo-error-foto').forEach(el => {
        el.classList.remove('campo-error', 'campo-error-foto');
    });

    // Validar monto
    if (!montoInput.value || parseFloat(montoInput.value) <= 0) {
        montoInput.classList.add('campo-error');
        camposVacios.push('Monto');
        setTimeout(() => montoInput.classList.remove('campo-error'), 1500);
    }

    // Validar motivo
    if (!motivoInput.value.trim()) {
        motivoInput.classList.add('campo-error');
        camposVacios.push('Motivo');
        setTimeout(() => motivoInput.classList.remove('campo-error'), 1500);
    }

    // Validar foto
    if (!currentPhoto) {
        if (fotoButtonsDiv) {
            const buttons = fotoButtonsDiv.querySelectorAll('.btn-foto');
            buttons.forEach(btn => {
                btn.classList.add('campo-error-foto');
                setTimeout(() => btn.classList.remove('campo-error-foto'), 1500);
            });
        }
        camposVacios.push('Fotografía');
    }

    return camposVacios;
}

document.getElementById('transferencia-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validar campos
    const camposVacios = validarCampos();

    if (camposVacios.length > 0) {
        showMessage('Por favor completa todos los campos requeridos', 'error');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo foto...';

    try {
        const motivo = document.getElementById('motivo').value;

        // Primero subir la foto a Supabase Bucket
        const resultUpload = await uploadPhotoToSupabase(currentPhoto, motivo);
        const fotoURL = resultUpload.publicUrl;
        const msgId = resultUpload.messageId;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        // Obtener el nombre completo del usuario
        let nombreCompleto = currentUser.email;
        if (currentUserData && currentUserData.nombres && currentUserData.apellidos) {
            nombreCompleto = currentUserData.nombres + ' ' + currentUserData.apellidos;
        }

        const transferencia = {
            caso: document.getElementById('caso').value,
            monto: parseFloat(document.getElementById('monto').value),
            motivo: motivo,
            fotografia: fotoURL,
            user_id: currentUser.id,
            subido_por: currentUser.email,
            id_message: msgId // Guardamos el ID que viene del webhook inicial
        };

        const { data, error } = await supabaseClient
            .from('ferre_transferencias')
            .insert([transferencia])
            .select();

        if (error) throw error;

        showMessage('Transferencia guardada exitosamente', 'success');

        e.target.reset();
        currentPhoto = null;
        fotoPreview.style.display = 'none';
        previewImg.src = '';
        document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tipo-btn[data-tipo="ingreso"]').classList.add('active');
        document.getElementById('caso').value = 'ingreso';

        if (currentUserData && (currentUserData.rol === 'admin' || currentUserData.rol === 'contador')) {
            loadSaldo();
            loadTransferencias();
        } else {
            loadTransferenciasDelDia();
        }

    } catch (error) {
        console.error('Error:', error);
        showMessage('Error al guardar: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'alert alert-' + type;
    messageDiv.style.cssText =
        'position: fixed;' +
        'top: 80px;' +
        'right: 20px;' +
        'padding: 15px 20px;' +
        'background: ' + (type === 'success' ? '#4CAF50' : '#f44336') + ';' +
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
    }, 3000);
}

// Funciones del modal
const modal = document.getElementById('modal-detalle');
const modalClose = document.querySelector('.modal-close');

function mostrarModal(transferencia) {
    const fecha = new Date(transferencia.fechahora);
    const fechaFormato = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const tipoHTML = transferencia.caso === 'ingreso' ?
        '<span class="badge badge-ingreso"><i class="fas fa-arrow-up"></i> Ingreso</span>' :
        '<span class="badge badge-egreso"><i class="fas fa-arrow-down"></i> Egreso</span>';

    const signo = transferencia.caso === 'ingreso' ? '+' : '-';

    document.getElementById('modal-fecha').textContent = fechaFormato;
    document.getElementById('modal-tipo').innerHTML = tipoHTML;
    document.getElementById('modal-monto').innerHTML = '<strong class="monto-' + transferencia.caso + '">' + signo + '$' + parseFloat(transferencia.monto).toFixed(2) + '</strong>';
    document.getElementById('modal-subido').textContent = transferencia.subido_por_nombre || transferencia.subido_por || 'N/A';
    document.getElementById('modal-motivo').textContent = transferencia.motivo;

    if (transferencia.fotografia) {
        document.getElementById('modal-img').src = transferencia.fotografia;
        document.getElementById('modal-img').style.display = 'block';
    } else {
        document.getElementById('modal-img').style.display = 'none';
    }

    modal.style.display = 'block';
}

modalClose.onclick = () => {
    modal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

async function logout() {
    try {
        // Cerrar sesión en Supabase con scope local (evita el error 403)
        await supabaseClient.auth.signOut({ scope: 'local' });
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        // Continuar con el logout aunque falle
    }

    // Limpiar localStorage
    localStorage.removeItem('userRole');
    localStorage.removeItem('userNombres');
    localStorage.removeItem('userApellidos');

    // Limpiar sessionStorage también
    sessionStorage.clear();

    // Redirigir al login con parámetro de logout y replace para evitar volver atrás
    window.location.replace('login.html?logout=true');
}

// Event listeners para filtros (solo si están disponibles)
if (searchInput) {
    searchInput.addEventListener('input', filterTransferencias);
}
if (filterCaso) {
    filterCaso.addEventListener('change', filterTransferencias);
}

// =====================================================
// NUEVA FUNCIONALIDAD: MODAL DE LISTA DE TRANSACCIONES
// =====================================================

const cardIngresos = document.getElementById('card-ingresos');
const cardEgresos = document.getElementById('card-egresos');
const modalLista = document.getElementById('modal-lista');
const modalListaTbody = document.getElementById('modal-lista-tbody');
const btnCargarMas = document.getElementById('btn-cargar-mas');
const modalListaActions = document.getElementById('modal-lista-actions');

let currentListaItems = [];
let currentListaPage = 0;
const ITEMS_PER_PAGE = 10;

if (cardIngresos) {
    cardIngresos.addEventListener('click', () => mostrarModalLista('ingreso'));
}
if (cardEgresos) {
    cardEgresos.addEventListener('click', () => mostrarModalLista('egreso'));
}

if (btnCargarMas) {
    btnCargarMas.addEventListener('click', cargarMasItems);
}

function mostrarModalLista(tipo) {
    const titulo = tipo === 'ingreso' ? 'Ingresos' : 'Egresos';
    const modalTitle = document.getElementById('modal-lista-title');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas fa-list"></i> Lista de ${titulo}`;
    }

    // Filter items
    currentListaItems = allTransferencias.filter(t => t.caso === tipo);
    currentListaPage = 0;

    if (modalListaTbody) {
        modalListaTbody.innerHTML = '';
    }

    if (modalLista) {
        modalLista.style.display = 'block';
    }

    cargarMasItems();
}

function cargarMasItems() {
    const start = currentListaPage * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const itemsToShow = currentListaItems.slice(start, end);

    renderListaItems(itemsToShow);

    currentListaPage++;

    if (modalListaActions) {
        if (end >= currentListaItems.length) {
            modalListaActions.style.display = 'none';
        } else {
            modalListaActions.style.display = 'block';
        }
    }
}

function renderListaItems(items) {
    if (!modalListaTbody) return;

    const html = items.map(t => {
        const fecha = new Date(t.fechahora);
        const fechaFormato = fecha.toLocaleDateString('es-ES') + ' ' + fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Escape single quotes for the onclick handler
        const tString = JSON.stringify(t).replace(/'/g, "&#39;").replace(/"/g, "&quot;");

        return `
            <tr>
                <td>${fechaFormato}</td>
                <td>$${parseFloat(t.monto).toFixed(2)}</td>
                <td>${t.motivo}</td>
                <td>
                    <button class="btn-icon" onclick='mostrarModal(${tString})' title="Ver Foto">
                        <i class="fas fa-camera"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    modalListaTbody.insertAdjacentHTML('beforeend', html);
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    if (event.target === modalLista) {
        modalLista.style.display = 'none';
    }
});

// Inicializar: primero desde caché (instantáneo), luego verificar auth
setupViewFromCache();
checkAuth();

// Estilos para animaciones
const style = document.createElement('style');
style.textContent =
    '@keyframes slideIn {' +
    '    from {' +
    '        transform: translateX(400px);' +
    '        opacity: 0;' +
    '    }' +
    '    to {' +
    '        transform: translateX(0);' +
    '        opacity: 1;' +
    '    }' +
    '}' +
    '@keyframes slideOut {' +
    '    from {' +
    '        transform: translateX(0);' +
    '        opacity: 1;' +
    '    }' +
    '    to {' +
    '        transform: translateX(400px);' +
    '        opacity: 0;' +
    '    }' +
    '}';
document.head.appendChild(style);

// =====================================================
// FUNCIONES DE NOTIFICACIÓN WHATSAPP
// =====================================================

async function obtenerConfiguracionWhatsApp(supabase) {
    try {
        const { data, error } = await supabase
            .from('ferre_ferredatos')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Error al obtener configuración WhatsApp:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error en obtenerConfiguracionWhatsApp:', error);
        return null;
    }
}

async function enviarNotificacionWhatsApp(transferencia, ferredatos) {
    try {
        const fecha = new Date(transferencia.fechahora);
        const fechaFormateada = fecha.toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const horaFormateada = fecha.toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const emoji = transferencia.caso === 'ingreso' ? '💰' : '💸';
        const tipoMovimiento = transferencia.caso === 'ingreso' ? 'INGRESO' : 'EGRESO';
        const montoFormateado = parseFloat(transferencia.monto).toFixed(2);

        // Construir el mensaje personalizado
        const mensaje = `${emoji} *Nueva Transferencia Registrada*

*DETALLES DEL MOVIMIENTO*


📅 *Fecha:* ${fechaFormateada}
🕐 *Hora:* ${horaFormateada}

${transferencia.caso === 'ingreso' ? '✅' : '❌'} *Tipo:* ${tipoMovimiento}
💵 *Monto:* $${montoFormateado}

📝 *Motivo:*
${transferencia.motivo}

👤 *Registrado por:*
${transferencia.subido_por_nombre}

📸 *Comprobante adjunto*

_Sistema de Gestión FERRESOLUCIONES_
_Powered by FERRESOLUCIONES Tech_`;

        const url = `https://api.ferrisoluciones.com/message/sendMedia/${ferredatos.instance}`;
        const bodyData = {
            number: ferredatos.number,
            mediatype: 'image',
            mimetype: 'image/webp',
            caption: mensaje,
            media: transferencia.foto_url,
            fileName: `TRANSFERENCIA_${fechaFormateada.replace(/\//g, '-')}_${horaFormateada.replace(/:/g, '-')}.webp`,
            delay: 1000,
            linkPreview: false
        };

        const options = {
            method: 'POST',
            headers: {
                'apikey': ferredatos.apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bodyData)
        };

        const response = await fetch(url, options);
        const data = await response.json();

        if (response.ok) {
            return { success: true, data };
        } else {
            console.error('Error al enviar notificación:', data);
            return { success: false, error: data };
        }

    } catch (error) {
        console.error('Error en enviarNotificacionWhatsApp:', error);
        return { success: false, error: error.message };
    }
}

async function notificarTransferencia(transferencia, supabase) {
    try {
        const ferredatos = await obtenerConfiguracionWhatsApp(supabase);

        if (!ferredatos) {
            return { success: false, error: 'Configuración no disponible' };
        }

        const resultado = await enviarNotificacionWhatsApp(transferencia, ferredatos);
        return resultado;

    } catch (error) {
        console.error('Error en notificarTransferencia:', error);
        return { success: false, error: error.message };
    }
}
