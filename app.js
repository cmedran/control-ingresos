/* =========================================================
   CONFIGURACIÓN SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://lbsiqfenndpfncodezdb.supabase.co";

const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2lxZmVubmRwZm5jb2RlemRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mjg0NTksImV4cCI6MjEwNDEwNDQ1OX0.Rd2xKhCqOFvWc3DJ6q2n2qL9CFj9XVBSSyyhePURPJ4";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


/* =========================================================
   VARIABLES
========================================================= */

let scanner = null;

let ultimoTokenGenerado = null;
let ultimoDniGenerado = null;

let procesandoQR = false;

let ultimoQRDetectado = "";
let ultimoQRDetectadoEn = 0;

let toastTimer = null;


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const dniInput =
            document.getElementById("dni");

        dniInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {
                    generarQR();
                }

            }
        );


        await actualizarDashboard();

        await cargarRegistros();

    }
);


/* =========================================================
   UTILIDADES
========================================================= */

function escaparHTML(texto) {

    const div =
        document.createElement("div");

    div.textContent =
        texto ?? "";

    return div.innerHTML;
}


function formatearFecha(fecha) {

    if (!fecha) {
        return "-";
    }

    const date =
        new Date(fecha);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString(
        "es-AR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function esUUID(valor) {

    const regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return regex.test(valor);
}


/* =========================================================
   TOAST
========================================================= */

function mostrarToast(
    titulo,
    mensaje,
    tipo = "success"
) {

    const toast =
        document.getElementById("toast");

    const icon =
        document.getElementById("toastIcon");

    document.getElementById(
        "toastTitle"
    ).textContent = titulo;

    document.getElementById(
        "toastMessage"
    ).textContent = mensaje;


    if (tipo === "error") {

        icon.style.background =
            "#fef2f2";

        icon.style.color =
            "#dc2626";

        icon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="M12 9v4"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                />
                <circle
                    cx="12"
                    cy="16"
                    r="1"
                    fill="currentColor"
                />
                <path
                    d="M10.3 4.7 3.4 16.6A2 2 0 0 0 5.1 19.5h13.8a2 2 0 0 0 1.7-2.9L13.7 4.7a2 2 0 0 0-3.4 0Z"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                />
            </svg>
        `;

    } else {

        icon.style.background =
            "#ecfdf3";

        icon.style.color =
            "#16a34a";

        icon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="m5 12 4 4L19 6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        `;

    }


    toast.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer =
        setTimeout(
            () => {
                toast.classList.remove("show");
            },
            3500
        );
}


/* =========================================================
   DASHBOARD
========================================================= */

async function actualizarDashboard() {

    try {

        const { data, error } =
            await supabaseClient
                .from("ingresos")
                .select("estado");


        if (error) {
            throw error;
        }


        const total =
            data.length;

        const ingresos =
            data.filter(
                registro =>
                    registro.estado === "ingresado"
            ).length;

        const faltantes =
            total - ingresos;


        document.getElementById(
            "totalGenerados"
        ).textContent = total;


        document.getElementById(
            "totalIngresos"
        ).textContent = ingresos;


        document.getElementById(
            "totalFaltantes"
        ).textContent = faltantes;

    } catch (error) {

        console.error(
            "Error actualizando dashboard:",
            error
        );

    }
}


/* =========================================================
   GENERAR QR
========================================================= */

async function generarQR() {

    const input =
        document.getElementById("dni");

    const dni =
        input.value.trim();


    if (!dni) {

        mostrarToast(
            "DNI requerido",
            "Ingresá un DNI para generar el acceso.",
            "error"
        );

        input.focus();

        return;
    }


    if (!/^\d+$/.test(dni)) {

        mostrarToast(
            "DNI inválido",
            "El DNI debe contener solamente números.",
            "error"
        );

        input.focus();

        return;
    }


    const btn =
        document.getElementById("btnGenerar");


    btn.disabled = true;

    btn.innerHTML = `
        <span class="spinner"></span>
        Generando...
    `;


    try {

        /* -----------------------------------------
           Verificar DNI existente
        ----------------------------------------- */

        const {
            data: existente,
            error: errorBusqueda
        } = await supabaseClient
            .from("ingresos")
            .select("id, dni, estado")
            .eq("dni", dni)
            .maybeSingle();


        if (errorBusqueda) {
            throw errorBusqueda;
        }


        if (existente) {

            mostrarToast(
                "DNI ya registrado",
                "Ya existe un código generado para este DNI.",
                "error"
            );

            return;
        }


        /* -----------------------------------------
           Crear registro
        ----------------------------------------- */

        const {
            data,
            error
        } = await supabaseClient
            .from("ingresos")
            .insert({
                dni: dni
            })
            .select()
            .single();


        if (error) {
            throw error;
        }


        ultimoTokenGenerado =
            data.token;

        ultimoDniGenerado =
            data.dni;


        /* -----------------------------------------
           Generar QR
        ----------------------------------------- */

        const contenedorQR =
            document.getElementById("qrcode");


        contenedorQR.innerHTML = "";


        new QRCode(
            contenedorQR,
            {
                text: data.token,

                width: 320,
                height: 320,

                /*
                 * M ofrece un buen equilibrio
                 * entre tolerancia a daños y
                 * facilidad de lectura.
                 */
                correctLevel:
                    QRCode.CorrectLevel.M
            }
        );


        /* -----------------------------------------
           Mostrar información
        ----------------------------------------- */

        document.getElementById(
            "qrInfo"
        ).innerHTML = `
            Acceso asociado al DNI
            <strong>${escaparHTML(data.dni)}</strong>
        `;


        document.getElementById(
            "qrResult"
        ).classList.remove("hidden");


        document.getElementById(
            "btnCompartir"
        ).disabled = false;


        document.getElementById(
            "btnDescargar"
        ).disabled = false;


        document.getElementById(
            "btnImprimir"
        ).disabled = false;


        mostrarToast(
            "QR generado",
            "El código de acceso está listo para usar."
        );


        input.value = "";


        await actualizarDashboard();

        await cargarRegistros();

    } catch (error) {

        console.error(
            "Error generando QR:",
            error
        );


        mostrarToast(
            "Error",
            "No fue posible generar el código QR.",
            "error"
        );

    } finally {

        btn.disabled = false;

        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                />
            </svg>

            Generar QR
        `;

    }
}


/* =========================================================
   OBTENER QR COMO BLOB
========================================================= */

async function obtenerQRComoBlob() {

    const contenedor =
        document.getElementById("qrcode");


    const canvas =
        contenedor.querySelector("canvas");


    if (canvas) {

        return new Promise(
            resolve => {

                canvas.toBlob(
                    blob => resolve(blob),
                    "image/png"
                );

            }
        );

    }


    const img =
        contenedor.querySelector("img");


    if (!img) {
        throw new Error(
            "No se encontró la imagen del QR."
        );
    }


    const response =
        await fetch(img.src);


    return await response.blob();
}


/* =========================================================
   COMPARTIR WHATSAPP
========================================================= */

async function compartirWhatsApp() {

    if (!ultimoTokenGenerado) {

        mostrarToast(
            "Sin QR",
            "Primero generá un código QR.",
            "error"
        );

        return;
    }


    try {

        const blob =
            await obtenerQRComoBlob();


        const archivo =
            new File(
                [
                    blob
                ],
                `QR_DNI_${ultimoDniGenerado}.png`,
                {
                    type: "image/png"
                }
            );


        /*
         * En dispositivos compatibles,
         * Web Share permite seleccionar
         * WhatsApp y adjuntar realmente
         * el PNG.
         */

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({

                title:
                    "Código de acceso",

                text:
                    `Código de acceso - DNI ${ultimoDniGenerado}`,

                files: [archivo]

            });


            mostrarToast(
                "QR compartido",
                "El código fue enviado al menú de compartir."
            );

            return;
        }


        /*
         * Fallback para navegadores que
         * no soportan compartir archivos.
         */

        descargarBlob(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );


        const texto =
            encodeURIComponent(
                `Código de acceso - DNI ${ultimoDniGenerado}`
            );


        window.open(
            `https://wa.me/?text=${texto}`,
            "_blank"
        );


        mostrarToast(
            "QR preparado",
            "El PNG fue descargado y WhatsApp fue abierto."
        );

    } catch (error) {

        if (
            error?.name === "AbortError"
        ) {
            return;
        }


        console.error(
            "Error compartiendo QR:",
            error
        );


        mostrarToast(
            "Error al compartir",
            "No fue posible compartir el código.",
            "error"
        );
    }
}


/* =========================================================
   ENVIAR QR DE REGISTRO
========================================================= */

async function enviarWhatsAppRegistro(
    dni,
    token
) {

    try {

        const contenedor =
            document.createElement("div");


        contenedor.style.position =
            "fixed";

        contenedor.style.left =
            "-10000px";

        contenedor.style.top =
            "0";


        document.body.appendChild(
            contenedor
        );


        new QRCode(
            contenedor,
            {
                text: token,

                width: 320,
                height: 320,

                correctLevel:
                    QRCode.CorrectLevel.M
            }
        );


        /*
         * Esperamos a que qrcodejs
         * termine de construir el QR.
         */

        await new Promise(
            resolve =>
                setTimeout(resolve, 100)
        );


        const canvas =
            contenedor.querySelector("canvas");


        let blob;


        if (canvas) {

            blob =
                await new Promise(
                    resolve => {

                        canvas.toBlob(
                            result =>
                                resolve(result),
                            "image/png"
                        );

                    }
                );

        } else {

            const img =
                contenedor.querySelector("img");

            const response =
                await fetch(img.src);

            blob =
                await response.blob();
        }


        document.body.removeChild(
            contenedor
        );


        const archivo =
            new File(
                [
                    blob
                ],
                `QR_DNI_${dni}.png`,
                {
                    type: "image/png"
                }
            );


        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({

                title:
                    "Código de acceso",

                text:
                    `Código de acceso - DNI ${dni}`,

                files: [archivo]

            });

            return;
        }


        descargarBlob(
            blob,
            `QR_DNI_${dni}.png`
        );


        window.open(
            `https://wa.me/?text=${encodeURIComponent(
                `Código de acceso - DNI ${dni}`
            )}`,
            "_blank"
        );

    } catch (error) {

        console.error(
            "Error compartiendo registro:",
            error
        );


        mostrarToast(
            "Error",
            "No fue posible compartir el QR.",
            "error"
        );
    }
}


/* =========================================================
   DESCARGAR QR
========================================================= */

async function descargarQR() {

    if (!ultimoTokenGenerado) {
        return;
    }


    try {

        const blob =
            await obtenerQRComoBlob();


        descargarBlob(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );


        mostrarToast(
            "QR descargado",
            "La imagen fue guardada correctamente."
        );

    } catch (error) {

        console.error(
            error
        );

        mostrarToast(
            "Error",
            "No fue posible descargar el QR.",
            "error"
        );
    }
}


function descargarBlob(
    blob,
    nombre
) {

    const url =
        URL.createObjectURL(blob);


    const enlace =
        document.createElement("a");


    enlace.href =
        url;

    enlace.download =
        nombre;


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();


    setTimeout(
        () => {
            URL.revokeObjectURL(url);
        },
        1000
    );
}


/* =========================================================
   IMPRIMIR QR
========================================================= */

function imprimirQR() {

    if (!ultimoTokenGenerado) {
        return;
    }


    window.print();
}


/* =========================================================
   SCANNER
========================================================= */

async function iniciarScanner() {

    const resultado =
        document.getElementById("resultado");

    const btnIniciar =
        document.getElementById("iniciarScanner");

    const btnDetener =
        document.getElementById("detenerScanner");


    resultado.className =
        "resultado loading";


    resultado.innerHTML = `
        <div class="resultado-icon">
            <svg viewBox="0 0 24 24" fill="none">
                <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                />
            </svg>
        </div>

        <div>
            <strong>Activando cámara...</strong>
            <span>Esperando acceso a la cámara.</span>
        </div>
    `;


    try {

        if (scanner) {
            await detenerScanner();
        }


        scanner =
            new Html5Qrcode(
                "reader",
                {
                    verbose: false,

                    /*
                     * Le indicamos al lector que
                     * solamente nos interesa QR.
                     *
                     * Esto evita que analice otros
                     * formatos de códigos.
                     */

                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE
                    ],

                    /*
                     * Utiliza BarcodeDetector
                     * cuando el navegador lo soporte.
                     */

                    useBarCodeDetectorIfSupported: true
                }
            );


        const configuracion = {

            /*
             * Más cuadros por segundo
             * = menor tiempo de respuesta.
             */

            fps: 15,


            /*
             * Área de lectura dinámica.
             * Se adapta al tamaño del celular.
             */

            qrbox: (
                viewfinderWidth,
                viewfinderHeight
            ) => {

                const minEdge =
                    Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    );


                const size =
                    Math.floor(
                        minEdge * 0.72
                    );


                return {
                    width:
                        Math.min(
                            size,
                            340
                        ),

                    height:
                        Math.min(
                            size,
                            340
                        )
                };
            },


            /*
             * Vista cuadrada.
             */

            aspectRatio: 1.0,


            /*
             * Permite lectura incluso si
             * el navegador invierte la cámara.
             */

            disableFlip: false,


            /*
             * Intentamos conseguir una
             * imagen de cámara con buena
             * resolución.
             */

            videoConstraints: {

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

            () => {
                /*
                 * No hacemos nada con los
                 * frames donde todavía no
                 * se detectó un QR.
                 */
            }
        );


        btnIniciar.disabled =
            true;

        btnDetener.disabled =
            false;


        resultado.className =
            "resultado";


        resultado.innerHTML = `
            <div class="resultado-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <circle
                        cx="12"
                        cy="12"
                        r="8"
                        stroke="currentColor"
                        stroke-width="1.8"
                    />
                    <circle
                        cx="12"
                        cy="12"
                        r="2"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <div>
                <strong>Cámara activa</strong>
                <span>Apuntá al código QR para registrar el ingreso.</span>
            </div>
        `;

    } catch (error) {

        console.error(
            "Error iniciando scanner:",
            error
        );


        scanner = null;


        btnIniciar.disabled =
            false;

        btnDetener.disabled =
            true;


        resultado.className =
            "resultado error";


        resultado.innerHTML = `
            <div class="resultado-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 9v4"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <circle
                        cx="12"
                        cy="16"
                        r="1"
                        fill="currentColor"
                    />
                    <path
                        d="M10.3 4.7 3.4 16.6A2 2 0 0 0 5.1 19.5h13.8a2 2 0 0 0 1.7-2.9L13.7 4.7a2 2 0 0 0-3.4 0Z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linejoin="round"
                    />
                </svg>
            </div>

            <div>
                <strong>No se pudo iniciar la cámara</strong>
                <span>Verificá los permisos del navegador.</span>
            </div>
        `;


        mostrarToast(
            "Cámara no disponible",
            "Permití el acceso a la cámara e intentá nuevamente.",
            "error"
        );
    }
}


/* =========================================================
   QR DETECTADO
========================================================= */

async function qrDetectado(
    textoQR
) {

    /*
     * Evita que html5-qrcode
     * procese decenas de veces
     * el mismo QR.
     */

    if (procesandoQR) {
        return;
    }


    const ahora =
        Date.now();


    if (
        textoQR === ultimoQRDetectado &&
        ahora - ultimoQRDetectadoEn < 2500
    ) {
        return;
    }


    ultimoQRDetectado =
        textoQR;

    ultimoQRDetectadoEn =
        ahora;


    procesandoQR = true;


    const resultado =
        document.getElementById("resultado");


    resultado.className =
        "resultado loading";


    resultado.innerHTML = `
        <div class="resultado-icon">
            <svg viewBox="0 0 24 24" fill="none">
                <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="currentColor"
                    stroke-width="1.8"
                />
                <path
                    d="M12 8v4l2.5 2"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                />
            </svg>
        </div>

        <div>
            <strong>Verificando QR...</strong>
            <span>Consultando autorización de acceso.</span>
        </div>
    `;


    try {

        const token =
            textoQR.trim();


        /*
         * Primera validación local.
         * Evita enviar basura a Supabase.
         */

        if (!esUUID(token)) {

            resultado.className =
                "resultado error";


            resultado.innerHTML = `
                <div class="resultado-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path
                            d="M12 9v4"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                        />
                        <circle
                            cx="12"
                            cy="16"
                            r="1"
                            fill="currentColor"
                        />
                    </svg>
                </div>

                <div>
                    <strong>QR no válido</strong>
                    <span>El código detectado no pertenece al sistema.</span>
                </div>
            `;


            return;
        }


        /*
         * Consumir QR mediante la función
         * RPC de Supabase.
         */

        const {
            data,
            error
        } = await supabaseClient.rpc(
            "consumir_qr",
            {
                p_token: token
            }
        );


        if (error) {
            throw error;
        }


        /* -----------------------------------------
           INGRESO AUTORIZADO
        ----------------------------------------- */

        if (data?.ok) {

            resultado.className =
                "resultado success";


            resultado.innerHTML = `
                <div class="resultado-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path
                            d="m5 12 4 4L19 6"
                            stroke="currentColor"
                            stroke-width="2.2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>

                <div>
                    <strong>Ingreso autorizado</strong>
                    <span>
                        DNI:
                        <strong>${escaparHTML(data.dni)}</strong>
                    </span>
                </div>
            `;


            mostrarToast(
                "Ingreso autorizado",
                `DNI ${data.dni} registrado correctamente.`
            );


            /*
             * Al ser un QR válido y consumido,
             * detenemos el scanner.
             */

            await detenerScanner();


            await actualizarDashboard();

            await cargarRegistros();


            return;
        }


        /* -----------------------------------------
           QR YA UTILIZADO / INVÁLIDO
        ----------------------------------------- */

        resultado.className =
            "resultado error";


        const mensaje =
            data?.mensaje ||
            "El QR no pudo ser utilizado.";


        resultado.innerHTML = `
            <div class="resultado-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 9v4"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <circle
                        cx="12"
                        cy="16"
                        r="1"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <div>
                <strong>${escaparHTML(mensaje)}</strong>

                ${
                    data?.dni
                        ? `
                            <span>
                                DNI:
                                ${escaparHTML(data.dni)}
                            </span>
                          `
                        : `
                            <span>
                                Intentá nuevamente con otro código.
                            </span>
                          `
                }
            </div>
        `;


        /*
         * Si el QR ya fue utilizado,
         * detenemos la cámara.
         *
         * Si simplemente fue un QR inválido,
         * dejamos la cámara funcionando para
         * poder seguir buscando.
         */

        if (
            mensaje
                .toLowerCase()
                .includes("ya fue utilizado")
        ) {

            await detenerScanner();

        }


    } catch (error) {

        console.error(
            "Error procesando QR:",
            error
        );


        resultado.className =
            "resultado error";


        resultado.innerHTML = `
            <div class="resultado-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 9v4"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                    />
                    <circle
                        cx="12"
                        cy="16"
                        r="1"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <div>
                <strong>Error de conexión</strong>
                <span>
                    No fue posible verificar el código.
                </span>
            </div>
        `;


        mostrarToast(
            "Error",
            "No se pudo consultar el QR.",
            "error"
        );

    } finally {

        /*
         * Liberamos el bloqueo.
         */

        procesandoQR = false;
    }
}


/* =========================================================
   DETENER SCANNER
========================================================= */

async function detenerScanner() {

    const btnIniciar =
        document.getElementById("iniciarScanner");

    const btnDetener =
        document.getElementById("detenerScanner");

    const resultado =
        document.getElementById("resultado");


    if (scanner) {

        try {

            await scanner.stop();

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
    }


    btnIniciar.disabled =
        false;

    btnDetener.disabled =
        true;


    /*
     * Limpiamos el área de cámara.
     */

    const reader =
        document.getElementById("reader");

    reader.innerHTML = "";


    /*
     * Si no hay un mensaje de éxito/error
     * importante, mostramos estado detenido.
     */

    if (
        !resultado.classList.contains("success") &&
        !resultado.classList.contains("error")
    ) {

        resultado.className =
            "resultado";


        resultado.innerHTML = `
            <div class="resultado-icon">
                <svg viewBox="0 0 24 24" fill="none">
                    <rect
                        x="6"
                        y="6"
                        width="12"
                        height="12"
                        rx="2"
                        stroke="currentColor"
                        stroke-width="1.8"
                    />
                </svg>
            </div>

            <div>
                <strong>Escáner detenido</strong>
                <span>Presioná iniciar para activar la cámara.</span>
            </div>
        `;
    }
}


/* =========================================================
   CARGAR REGISTROS
========================================================= */

async function cargarRegistros() {

    const tabla =
        document.getElementById("tablaRegistros");

    const contador =
        document.getElementById("contadorRegistros");


    try {

        const {
            data,
            error
        } = await supabaseClient
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


        contador.textContent =
            `${data.length} ${
                data.length === 1
                    ? "registro"
                    : "registros"
            }`;


        if (!data.length) {

            tabla.innerHTML = `
                <tr>
                    <td
                        colspan="5"
                        class="empty-table"
                    >
                        No hay registros todavía.
                    </td>
                </tr>
            `;

            return;
        }


        tabla.innerHTML =
            data.map(
                registro => {

                    const ingresado =
                        registro.estado === "ingresado";


                    return `
                        <tr>

                            <td>
                                ${escaparHTML(
                                    registro.dni
                                )}
                            </td>


                            <td>

                                <span
                                    class="status-pill ${
                                        ingresado
                                            ? "status-entered"
                                            : "status-pending"
                                    }"
                                >
                                    ${
                                        ingresado
                                            ? "Ingresado"
                                            : "Pendiente"
                                    }
                                </span>

                            </td>


                            <td>
                                ${formatearFecha(
                                    registro.generado_en
                                )}
                            </td>


                            <td>
                                ${
                                    registro.ingresado_en
                                        ? formatearFecha(
                                            registro.ingresado_en
                                        )
                                        : "-"
                                }
                            </td>


                            <td>

                                <div
                                    style="
                                        display:flex;
                                        gap:6px;
                                    "
                                >

                                    <button
                                        type="button"
                                        class="btn-delete"
                                        title="Compartir QR"
                                        onclick="enviarWhatsAppRegistro(
                                            '${escaparHTML(
                                                registro.dni
                                            )}',
                                            '${registro.token}'
                                        )"
                                    >

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M20 4 10 14"
                                                stroke="currentColor"
                                                stroke-width="1.8"
                                                stroke-linecap="round"
                                            />
                                            <path
                                                d="m20 4-6 16-4-6-6-4 16-6Z"
                                                stroke="currentColor"
                                                stroke-width="1.8"
                                                stroke-linejoin="round"
                                            />
                                        </svg>

                                    </button>


                                    <button
                                        type="button"
                                        class="btn-delete"
                                        title="Eliminar registro"
                                        onclick="eliminarRegistro(
                                            '${registro.id}',
                                            '${escaparHTML(
                                                registro.dni
                                            )}'
                                        )"
                                    >

                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                        >
                                            <path
                                                d="M4 7h16"
                                                stroke="currentColor"
                                                stroke-width="1.8"
                                                stroke-linecap="round"
                                            />

                                            <path
                                                d="M9 7V4h6v3"
                                                stroke="currentColor"
                                                stroke-width="1.8"
                                            />

                                            <path
                                                d="m7 7 1 13h8l1-13"
                                                stroke="currentColor"
                                                stroke-width="1.8"
                                                stroke-linejoin="round"
                                            />

                                        </svg>

                                    </button>

                                </div>

                            </td>

                        </tr>
                    `;
                }
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando registros:",
            error
        );


        contador.textContent =
            "Error";


        tabla.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-table"
                >
                    No fue posible cargar los registros.
                </td>
            </tr>
        `;
    }
}


/* =========================================================
   ELIMINAR REGISTRO
========================================================= */

async function eliminarRegistro(
    id,
    dni
) {

    const confirmar =
        confirm(
            `¿Querés eliminar el registro del DNI ${dni}?`
        );


    if (!confirmar) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("ingresos")
            .delete()
            .eq("id", id);


        if (error) {
            throw error;
        }


        /*
         * Si acabamos de eliminar el QR
         * que estaba mostrado, limpiamos
         * el generador.
         */

        if (
            ultimoDniGenerado === dni
        ) {

            ultimoDniGenerado =
                null;

            ultimoTokenGenerado =
                null;


            document.getElementById(
                "qrcode"
            ).innerHTML = "";


            document.getElementById(
                "qrResult"
            ).classList.add("hidden");


            document.getElementById(
                "btnCompartir"
            ).disabled = true;


            document.getElementById(
                "btnDescargar"
            ).disabled = true;


            document.getElementById(
                "btnImprimir"
            ).disabled = true;
        }


        mostrarToast(
            "Registro eliminado",
            `El DNI ${dni} fue eliminado correctamente.`
        );


        await actualizarDashboard();

        await cargarRegistros();

    } catch (error) {

        console.error(
            "Error eliminando registro:",
            error
        );


        mostrarToast(
            "Error",
            "No fue posible eliminar el registro.",
            "error"
        );
    }
}