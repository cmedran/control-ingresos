// ============================================================
// CONFIGURACIÓN SUPABASE
// ============================================================

const SUPABASE_URL = "https://lbsiqfenndpfncodezdb.supabase.co";
const SUPABASE_ANON_KEY = "PEGÁ_AQUÍ_TU_ANON_KEY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// ============================================================
// VARIABLES GLOBALES
// ============================================================

let scanner = null;
let scannerActivo = false;
let procesandoQR = false;

let ultimoTokenGenerado = null;
let ultimoDniGenerado = null;

let ultimoQRDetectado = "";
let ultimoQRDetectadoEn = 0;


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    await actualizarDashboard();
    await cargarRegistros();

    actualizarBotonesScanner(false);
});


// ============================================================
// DASHBOARD
// ============================================================

async function actualizarDashboard() {
    try {
        const { data, error } = await supabaseClient
            .from("ingresos")
            .select("estado");

        if (error) throw error;

        const totalGenerados = data.length;
        const totalIngresos = data.filter(
            registro => registro.estado === "ingresado"
        ).length;

        const totalFaltantes = totalGenerados - totalIngresos;

        document.getElementById("totalGenerados").textContent =
            totalGenerados;

        document.getElementById("totalIngresos").textContent =
            totalIngresos;

        document.getElementById("totalFaltantes").textContent =
            totalFaltantes;

    } catch (error) {
        console.error("Error actualizando dashboard:", error);
    }
}


// ============================================================
// GENERAR QR
// ============================================================

async function generarQR() {

    const input = document.getElementById("dni");
    const dni = input.value.trim();

    if (!dni) {
        mostrarNotificacion("Ingresá un DNI.", "error");
        input.focus();
        return;
    }

    if (!/^\d+$/.test(dni)) {
        mostrarNotificacion(
            "El DNI debe contener solamente números.",
            "error"
        );
        input.focus();
        return;
    }

    try {

        // Verificar si el DNI ya existe
        const { data: existente, error: errorBusqueda } =
            await supabaseClient
                .from("ingresos")
                .select("id")
                .eq("dni", dni)
                .maybeSingle();

        if (errorBusqueda) throw errorBusqueda;

        if (existente) {
            mostrarNotificacion(
                "Ese DNI ya tiene un QR generado.",
                "error"
            );
            return;
        }


        // Crear registro
        const { data, error } = await supabaseClient
            .from("ingresos")
            .insert({
                dni: dni
            })
            .select()
            .single();

        if (error) throw error;


        // Guardar datos
        ultimoTokenGenerado = data.token;
        ultimoDniGenerado = data.dni;


        // Limpiar QR anterior
        const contenedorQR = document.getElementById("qrcode");
        contenedorQR.innerHTML = "";


        // Generar QR
        new QRCode(contenedorQR, {
            text: data.token,
            width: 320,
            height: 320,
            correctLevel: QRCode.CorrectLevel.M
        });


        // Mostrar información
        const qrInfo = document.getElementById("qrInfo");

        qrInfo.innerHTML = `
            <div class="qr-status success">
                <span class="status-dot"></span>
                QR generado correctamente
            </div>

            <div class="qr-person">
                <span>DNI</span>
                <strong>${escapeHTML(data.dni)}</strong>
            </div>

            <small>
                Este código puede utilizarse una sola vez.
            </small>
        `;


        // Activar botones
        document.getElementById("btnCompartir").disabled = false;
        document.getElementById("btnDescargar").disabled = false;
        document.getElementById("btnImprimir").disabled = false;


        input.value = "";

        await actualizarDashboard();
        await cargarRegistros();

        mostrarNotificacion(
            "QR generado correctamente.",
            "success"
        );

    } catch (error) {

        console.error("Error generando QR:", error);

        mostrarNotificacion(
            "No se pudo generar el QR.",
            "error"
        );
    }
}


// ============================================================
// OBTENER QR COMO BLOB
// ============================================================

async function obtenerQRComoBlob() {

    const contenedor = document.getElementById("qrcode");

    const canvas = contenedor.querySelector("canvas");

    if (canvas) {

        return new Promise(resolve => {

            canvas.toBlob(
                blob => resolve(blob),
                "image/png"
            );

        });

    }


    const img = contenedor.querySelector("img");

    if (img) {

        const response = await fetch(img.src);

        return await response.blob();
    }


    throw new Error("No se encontró el QR.");
}


// ============================================================
// COMPARTIR QR
// ============================================================

async function compartirWhatsApp() {

    if (!ultimoTokenGenerado || !ultimoDniGenerado) {
        mostrarNotificacion(
            "Primero generá un QR.",
            "error"
        );
        return;
    }

    try {

        const blob = await obtenerQRComoBlob();

        const archivo = new File(
            [blob],
            `QR_DNI_${ultimoDniGenerado}.png`,
            {
                type: "image/png"
            }
        );


        // Compartir nativamente
        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({
                title: "QR de acceso",
                text: `QR de acceso - DNI ${ultimoDniGenerado}`,
                files: [archivo]
            });

            return;
        }


        // Fallback
        descargarBlob(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );

        const mensaje = encodeURIComponent(
            `QR de acceso - DNI ${ultimoDniGenerado}`
        );

        window.open(
            `https://wa.me/?text=${mensaje}`,
            "_blank"
        );

    } catch (error) {

        console.error("Error compartiendo:", error);

        if (error.name !== "AbortError") {

            mostrarNotificacion(
                "No se pudo compartir el QR.",
                "error"
            );
        }
    }
}


// ============================================================
// ENVIAR QR DESDE TABLA
// ============================================================

async function enviarWhatsAppRegistro(dni, token) {

    try {

        const contenedor = document.createElement("div");

        contenedor.style.position = "fixed";
        contenedor.style.left = "-99999px";
        contenedor.style.top = "0";

        document.body.appendChild(contenedor);


        new QRCode(contenedor, {
            text: token,
            width: 320,
            height: 320,
            correctLevel: QRCode.CorrectLevel.M
        });


        await new Promise(resolve =>
            setTimeout(resolve, 150)
        );


        let blob;

        const canvas = contenedor.querySelector("canvas");

        if (canvas) {

            blob = await new Promise(resolve =>
                canvas.toBlob(
                    resolve,
                    "image/png"
                )
            );

        } else {

            const img = contenedor.querySelector("img");

            const response = await fetch(img.src);

            blob = await response.blob();
        }


        const archivo = new File(
            [blob],
            `QR_DNI_${dni}.png`,
            {
                type: "image/png"
            }
        );


        document.body.removeChild(contenedor);


        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({
                title: "QR de acceso",
                text: `QR de acceso - DNI ${dni}`,
                files: [archivo]
            });

            return;
        }


        descargarBlob(
            blob,
            `QR_DNI_${dni}.png`
        );


        const mensaje = encodeURIComponent(
            `QR de acceso - DNI ${dni}`
        );

        window.open(
            `https://wa.me/?text=${mensaje}`,
            "_blank"
        );

    } catch (error) {

        console.error(
            "Error compartiendo QR:",
            error
        );

        mostrarNotificacion(
            "No se pudo compartir el QR.",
            "error"
        );
    }
}


// ============================================================
// DESCARGAR QR
// ============================================================

async function descargarQR() {

    try {

        const blob = await obtenerQRComoBlob();

        descargarBlob(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );

    } catch (error) {

        console.error(error);

        mostrarNotificacion(
            "No se pudo descargar el QR.",
            "error"
        );
    }
}


function descargarBlob(blob, nombre) {

    const url = URL.createObjectURL(blob);

    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombre;

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();

    URL.revokeObjectURL(url);
}


// ============================================================
// IMPRIMIR QR
// ============================================================

function imprimirQR() {

    if (!ultimoTokenGenerado) {

        mostrarNotificacion(
            "Primero generá un QR.",
            "error"
        );

        return;
    }


    const contenedor = document.getElementById("qrcode");

    const imagen =
        contenedor.querySelector("img") ||
        contenedor.querySelector("canvas");


    if (!imagen) {

        mostrarNotificacion(
            "No se encontró el QR.",
            "error"
        );

        return;
    }


    const ventana = window.open(
        "",
        "_blank",
        "width=500,height=700"
    );


    let src;

    if (imagen.tagName === "CANVAS") {
        src = imagen.toDataURL("image/png");
    } else {
        src = imagen.src;
    }


    ventana.document.write(`
        <!DOCTYPE html>

        <html>

        <head>

            <title>QR de acceso</title>

            <style>

                body {
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: Arial, sans-serif;
                }

                .ticket {
                    text-align: center;
                }

                img {
                    width: 320px;
                    height: 320px;
                }

                h2 {
                    margin-bottom: 8px;
                }

                p {
                    margin-top: 0;
                    color: #555;
                }

            </style>

        </head>

        <body>

            <div class="ticket">

                <h2>QR DE ACCESO</h2>

                <p>DNI: ${escapeHTML(ultimoDniGenerado)}</p>

                <img src="${src}">

            </div>

        </body>

        </html>
    `);


    ventana.document.close();

    ventana.focus();

    setTimeout(() => {

        ventana.print();

    }, 300);
}


// ============================================================
// SCANNER
// ============================================================

async function iniciarScanner() {

    const resultado =
        document.getElementById("resultado");

    resultado.className = "resultado";

    resultado.innerHTML = `
        <div class="scanner-status loading">
            <span class="spinner"></span>
            Iniciando cámara trasera...
        </div>
    `;


    try {

        if (scanner) {
            await detenerScanner();
        }


        scanner = new Html5Qrcode(
            "reader",
            {
                verbose: false
            }
        );


        /*
         * IMPORTANTE:
         *
         * "environment" = cámara trasera
         * "user"        = cámara frontal
         *
         * Usamos environment explícitamente.
         */

        const configuracion = {

            fps: 15,

            qrbox: function (
                viewfinderWidth,
                viewfinderHeight
            ) {

                const minEdge = Math.min(
                    viewfinderWidth,
                    viewfinderHeight
                );

                const size = Math.floor(
                    minEdge * 0.72
                );

                return {
                    width: Math.min(size, 340),
                    height: Math.min(size, 340)
                };
            },

            aspectRatio: 1.0,

            disableFlip: false,

            videoConstraints: {

                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                }

            }

        };


        await scanner.start(

            {
                facingMode: "environment"
            },

            configuracion,

            qrDetectado,

            error => {
                // Los errores de lectura individuales
                // se ignoran para evitar mensajes molestos.
            }

        );


        scannerActivo = true;

        actualizarBotonesScanner(true);


        resultado.className =
            "resultado resultado-info";

        resultado.innerHTML = `
            <div class="scanner-status active">
                <span class="status-dot"></span>
                Cámara trasera activa
            </div>

            <span>
                Apuntá el QR dentro del marco.
            </span>
        `;


    } catch (error) {

        console.error(
            "Error iniciando scanner:",
            error
        );


        scannerActivo = false;

        actualizarBotonesScanner(false);


        resultado.className =
            "resultado resultado-error";

        resultado.innerHTML = `
            <strong>No se pudo iniciar la cámara.</strong>
            <br>
            Verificá los permisos de cámara del navegador.
        `;

    }
}


// ============================================================
// QR DETECTADO
// ============================================================

async function qrDetectado(textoQR) {

    if (procesandoQR) {
        return;
    }


    const token = textoQR.trim();

    const ahora = Date.now();


    // Evita procesar el mismo QR varias veces
    if (
        token === ultimoQRDetectado &&
        ahora - ultimoQRDetectadoEn < 2500
    ) {

        return;
    }


    ultimoQRDetectado = token;

    ultimoQRDetectadoEn = ahora;


    // Validar UUID
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


    if (!uuidRegex.test(token)) {

        mostrarResultadoScanner(
            "QR no válido",
            "El código detectado no pertenece al sistema.",
            "error"
        );

        return;
    }


    procesandoQR = true;


    mostrarResultadoScanner(
        "Verificando QR...",
        "Espere un momento.",
        "loading"
    );


    try {

        const { data, error } =
            await supabaseClient.rpc(
                "consumir_qr",
                {
                    p_token: token
                }
            );


        if (error) {
            throw error;
        }


        // ====================================================
        // INGRESO AUTORIZADO
        // ====================================================

        if (data && data.ok) {

            mostrarResultadoScanner(
                "¡INGRESO AUTORIZADO!",
                `DNI: ${data.dni}`,
                "success"
            );


            // Detener cámara después de validar
            await detenerScanner();


            await actualizarDashboard();
            await cargarRegistros();


            return;
        }


        // ====================================================
        // QR YA UTILIZADO / INVÁLIDO
        // ====================================================

        mostrarResultadoScanner(
            "ACCESO DENEGADO",
            data?.mensaje || "QR no válido.",
            "error"
        );


        // Dejamos la cámara funcionando para poder
        // escanear otro QR inmediatamente.


    } catch (error) {

        console.error(
            "Error validando QR:",
            error
        );


        mostrarResultadoScanner(
            "ERROR",
            "No se pudo verificar el QR.",
            "error"
        );

    } finally {

        procesandoQR = false;
    }
}


// ============================================================
// DETENER SCANNER
// ============================================================

async function detenerScanner() {

    if (!scanner) {

        scannerActivo = false;

        actualizarBotonesScanner(false);

        return;
    }


    try {

        if (scannerActivo) {

            await scanner.stop();
        }

    } catch (error) {

        console.warn(
            "Error deteniendo scanner:",
            error
        );

    }


    try {

        await scanner.clear();

    } catch (error) {

        console.warn(
            "Error limpiando scanner:",
            error
        );
    }


    scanner = null;

    scannerActivo = false;

    actualizarBotonesScanner(false);


    const reader =
        document.getElementById("reader");

    if (reader) {
        reader.innerHTML = "";
    }
}


// ============================================================
// BOTONES DEL SCANNER
// ============================================================

function actualizarBotonesScanner(activo) {

    const iniciar =
        document.getElementById("iniciarScanner");

    const detener =
        document.getElementById("detenerScanner");


    if (iniciar) {
        iniciar.disabled = activo;
    }

    if (detener) {
        detener.disabled = !activo;
    }
}


// ============================================================
// RESULTADO SCANNER
// ============================================================

function mostrarResultadoScanner(
    titulo,
    mensaje,
    tipo
) {

    const resultado =
        document.getElementById("resultado");


    resultado.className =
        `resultado resultado-${tipo}`;


    let icono = "✓";

    if (tipo === "error") {
        icono = "✕";
    }

    if (tipo === "loading") {
        icono = "⟳";
    }


    resultado.innerHTML = `

        <div class="resultado-icon">
            ${icono}
        </div>

        <div class="resultado-contenido">

            <strong>
                ${escapeHTML(titulo)}
            </strong>

            <span>
                ${escapeHTML(mensaje)}
            </span>

        </div>

    `;
}


// ============================================================
// CARGAR REGISTROS
// ============================================================

async function cargarRegistros() {

    const tabla =
        document.getElementById("tablaRegistros");


    try {

        const { data, error } =
            await supabaseClient
                .from("ingresos")
                .select("*")
                .order(
                    "generado_en",
                    {
                        ascending: false
                    }
                );


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="tabla-vacia">
                        No hay registros todavía.
                    </td>
                </tr>
            `;

            return;
        }


        tabla.innerHTML = data.map(registro => {

            const fechaGenerado =
                formatearFecha(
                    registro.generado_en
                );

            const fechaIngreso =
                registro.ingresado_en
                    ? formatearFecha(
                        registro.ingresado_en
                    )
                    : "—";


            const estado =
                registro.estado === "ingresado"
                    ? `
                        <span class="badge badge-success">
                            Ingresado
                        </span>
                    `
                    : `
                        <span class="badge badge-warning">
                            Pendiente
                        </span>
                    `;


            return `

                <tr>

                    <td>
                        <strong>
                            ${escapeHTML(registro.dni)}
                        </strong>
                    </td>

                    <td>
                        <code>
                            ${escapeHTML(registro.token)}
                        </code>
                    </td>

                    <td>
                        ${fechaGenerado}
                    </td>

                    <td>
                        ${fechaIngreso}
                    </td>

                    <td>
                        ${estado}
                    </td>

                    <td>

                        <div class="table-actions">

                            ${
                                registro.estado === "pendiente"
                                ?
                                `
                                    <button
                                        class="btn btn-small btn-secondary"
                                        onclick="enviarWhatsAppRegistro(
                                            '${registro.dni}',
                                            '${registro.token}'
                                        )"
                                        title="Compartir QR"
                                    >
                                        WhatsApp
                                    </button>
                                `
                                :
                                ""
                            }

                            <button
                                class="btn btn-small btn-danger"
                                onclick="eliminarRegistro(
                                    '${registro.id}'
                                )"
                                title="Eliminar"
                            >
                                Eliminar
                            </button>

                        </div>

                    </td>

                </tr>

            `;

        }).join("");


    } catch (error) {

        console.error(
            "Error cargando registros:",
            error
        );


        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="tabla-vacia">
                    Error cargando registros.
                </td>
            </tr>
        `;
    }
}


// ============================================================
// ELIMINAR REGISTRO
// ============================================================

async function eliminarRegistro(id) {

    const confirmar = confirm(
        "¿Seguro que querés eliminar este registro?"
    );


    if (!confirmar) {
        return;
    }


    try {

        const { error } =
            await supabaseClient
                .from("ingresos")
                .delete()
                .eq("id", id);


        if (error) {
            throw error;
        }


        await actualizarDashboard();

        await cargarRegistros();


        mostrarNotificacion(
            "Registro eliminado.",
            "success"
        );


    } catch (error) {

        console.error(
            "Error eliminando registro:",
            error
        );


        mostrarNotificacion(
            "No se pudo eliminar el registro.",
            "error"
        );
    }
}


// ============================================================
// UTILIDADES
// ============================================================

function formatearFecha(fecha) {

    if (!fecha) {
        return "—";
    }


    return new Date(fecha).toLocaleString(
        "es-AR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}


function escapeHTML(texto) {

    const div =
        document.createElement("div");

    div.textContent = texto;

    return div.innerHTML;
}


// ============================================================
// NOTIFICACIONES
// ============================================================

function mostrarNotificacion(
    mensaje,
    tipo = "success"
) {

    let contenedor =
        document.getElementById(
            "notificaciones"
        );


    if (!contenedor) {

        contenedor =
            document.createElement("div");

        contenedor.id =
            "notificaciones";

        document.body.appendChild(
            contenedor
        );
    }


    const notificacion =
        document.createElement("div");


    notificacion.className =
        `notificacion notificacion-${tipo}`;


    notificacion.innerHTML = `
        <span class="notificacion-icon">
            ${tipo === "success" ? "✓" : "!"}
        </span>

        <span>
            ${escapeHTML(mensaje)}
        </span>
    `;


    contenedor.appendChild(
        notificacion
    );


    setTimeout(() => {

        notificacion.classList.add(
            "ocultar"
        );

        setTimeout(() => {

            notificacion.remove();

        }, 300);

    }, 3000);
}