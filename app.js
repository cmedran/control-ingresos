// =========================================================
// CONFIGURACIÓN SUPABASE
// =========================================================

const SUPABASE_URL =
    "https://lbsiqfenndpfncodezdb.supabase.co";

const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxic2lxZmVubmRwZm5jb2RlemRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Mjg0NTksImV4cCI6MjEwNDEwNDQ1OX0.Rd2xKhCqOFvWc3DJ6q2n2qL9CFj9XVBSSyyhePURPJ4";


// Crear cliente Supabase
const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );


// =========================================================
// VARIABLES
// =========================================================

let scanner = null;

let ultimoTokenGenerado = null;
let ultimoDniGenerado = null;


// =========================================================
// INICIO
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await actualizarDashboard();

        await cargarRegistros();

    }
);


// =========================================================
// GENERAR QR
// =========================================================

async function generarQR() {

    const input = document.getElementById("dni");

    const dni = input.value.trim();


    // Validar DNI
    if (!dni) {

        alert("Ingresá un DNI.");

        input.focus();

        return;
    }


    if (!/^\d+$/.test(dni)) {

        alert("El DNI debe contener solamente números.");

        input.focus();

        return;
    }


    try {

        // Verificar si ya existe
        const { data: existente, error: errorBusqueda } =
            await supabaseClient
                .from("ingresos")
                .select("id")
                .eq("dni", dni)
                .maybeSingle();


        if (errorBusqueda) {

            console.error(errorBusqueda);

            alert(
                "No se pudo consultar la base de datos."
            );

            return;
        }


        if (existente) {

            alert(
                "Ya existe un QR generado para este DNI."
            );

            return;
        }


        // Insertar registro
        const { data, error } =
            await supabaseClient
                .from("ingresos")
                .insert([
                    {
                        dni: dni
                    }
                ])
                .select()
                .single();


        if (error) {

            console.error(error);

            alert(
                "No se pudo generar el QR."
            );

            return;
        }


        // Guardar datos
        ultimoDniGenerado = data.dni;

        ultimoTokenGenerado = data.token;


        // Limpiar QR anterior
        const contenedorQR =
            document.getElementById("qrcode");

        contenedorQR.innerHTML = "";


        // Crear QR usando TOKEN
        new QRCode(
            contenedorQR,
            {
                text: data.token,
                width: 250,
                height: 250,
                correctLevel: QRCode.CorrectLevel.H
            }
        );


        // Información
        document.getElementById("qrInfo").innerHTML =
            `<strong>DNI:</strong> ${data.dni}<br>
             QR generado correctamente.`;


        // Activar botones
        document.getElementById(
            "btnCompartir"
        ).disabled = false;


        document.getElementById(
            "btnDescargar"
        ).disabled = false;


        document.getElementById(
            "btnImprimir"
        ).disabled = false;


        // Limpiar input
        input.value = "";


        // Actualizar información
        await actualizarDashboard();

        await cargarRegistros();


    } catch (error) {

        console.error(error);

        alert(
            "Ocurrió un error inesperado."
        );

    }

}


// =========================================================
// OBTENER QR COMO BLOB
// =========================================================

async function obtenerQRComoBlob() {

    return new Promise(
        (resolve, reject) => {

            // qrcodejs normalmente genera canvas
            const canvas =
                document.querySelector(
                    "#qrcode canvas"
                );


            if (canvas) {

                canvas.toBlob(
                    (blob) => {

                        if (!blob) {

                            reject(
                                new Error(
                                    "No se pudo convertir el QR en imagen."
                                )
                            );

                            return;
                        }

                        resolve(blob);

                    },
                    "image/png"
                );

                return;
            }


            // Fallback si existe solamente IMG
            const img =
                document.querySelector(
                    "#qrcode img"
                );


            if (!img) {

                reject(
                    new Error(
                        "No se encontró el QR."
                    )
                );

                return;
            }


            const imagen =
                new Image();


            imagen.onload = () => {

                const nuevoCanvas =
                    document.createElement(
                        "canvas"
                    );


                nuevoCanvas.width =
                    imagen.naturalWidth ||
                    imagen.width;


                nuevoCanvas.height =
                    imagen.naturalHeight ||
                    imagen.height;


                const contexto =
                    nuevoCanvas.getContext("2d");


                contexto.drawImage(
                    imagen,
                    0,
                    0
                );


                nuevoCanvas.toBlob(
                    (blob) => {

                        if (!blob) {

                            reject(
                                new Error(
                                    "No se pudo generar la imagen."
                                )
                            );

                            return;
                        }

                        resolve(blob);

                    },
                    "image/png"
                );

            };


            imagen.onerror = () => {

                reject(
                    new Error(
                        "No se pudo cargar la imagen del QR."
                    )
                );

            };


            imagen.src = img.src;

        }
    );

}


// =========================================================
// COMPARTIR QR
// =========================================================

async function compartirWhatsApp() {

    if (
        !ultimoTokenGenerado ||
        !ultimoDniGenerado
    ) {

        alert(
            "Primero generá un QR."
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


        const mensaje =
            `Hola 👋\n\n` +
            `Este es tu código QR de acceso.\n\n` +
            `DNI: ${ultimoDniGenerado}\n\n` +
            `Presentá este QR al momento de ingresar.\n` +
            `El código es válido para un único ingreso.`;


        // =================================================
        // COMPARTIR ARCHIVO NATIVAMENTE
        // =================================================

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({

                title:
                    "Código QR de acceso",

                text:
                    mensaje,

                files:
                    [archivo]

            });

            return;
        }


        // =================================================
        // FALLBACK
        // =================================================

        descargarArchivo(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );


        const whatsappURL =
            `https://wa.me/?text=` +
            encodeURIComponent(
                mensaje
            );


        window.open(
            whatsappURL,
            "_blank"
        );


        alert(
            "El navegador no permite compartir archivos directamente.\n\n" +
            "El QR fue descargado. Adjuntalo en WhatsApp."
        );


    } catch (error) {

        console.error(
            "Error al compartir:",
            error
        );


        // Si el usuario canceló el menú de compartir
        if (
            error.name === "AbortError"
        ) {

            return;
        }


        alert(
            "No se pudo compartir el QR.\n\n" +
            error.message
        );

    }

}


// =========================================================
// DESCARGAR QR ACTUAL
// =========================================================

async function descargarQR() {

    if (!ultimoDniGenerado) {

        alert(
            "Primero generá un QR."
        );

        return;
    }


    try {

        const blob =
            await obtenerQRComoBlob();


        descargarArchivo(
            blob,
            `QR_DNI_${ultimoDniGenerado}.png`
        );


    } catch (error) {

        console.error(error);

        alert(
            "No se pudo descargar el QR."
        );

    }

}


// =========================================================
// DESCARGAR ARCHIVO
// =========================================================

function descargarArchivo(
    blob,
    nombre
) {

    const url =
        URL.createObjectURL(blob);


    const enlace =
        document.createElement("a");


    enlace.href = url;

    enlace.download = nombre;


    document.body.appendChild(
        enlace
    );


    enlace.click();


    document.body.removeChild(
        enlace
    );


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );

}


// =========================================================
// IMPRIMIR
// =========================================================

function imprimirQR() {

    if (!ultimoDniGenerado) {

        alert(
            "Primero generá un QR."
        );

        return;
    }


    window.print();

}


// =========================================================
// INICIAR SCANNER
// =========================================================

async function iniciarScanner() {

    const resultado =
        document.getElementById(
            "resultado"
        );


    resultado.className =
        "resultado";


    resultado.innerHTML =
        "Solicitando acceso a la cámara...";


    try {

        if (scanner) {

            await detenerScanner();

        }


        scanner =
            new Html5Qrcode(
                "reader"
            );


        const configuracion = {

            fps: 10,

            qrbox: {
                width: 250,
                height: 250
            }

        };


        await scanner.start(

            {
                facingMode: "environment"
            },

            configuracion,

            qrDetectado,

            error => {

                // Ignorar errores normales
                // mientras busca un QR

            }

        );


        resultado.innerHTML =
            "Cámara activa. Apuntá al código QR.";


    } catch (error) {

        console.error(error);


        resultado.className =
            "resultado error";


        resultado.innerHTML =
            "No se pudo iniciar la cámara.<br><br>" +
            "Verificá los permisos del navegador.";

    }

}


// =========================================================
// DETENER SCANNER
// =========================================================

async function detenerScanner() {

    if (!scanner) {

        return;
    }


    try {

        await scanner.stop();

        await scanner.clear();

    } catch (error) {

        console.error(
            "Error deteniendo scanner:",
            error
        );

    }


    scanner = null;

}


// =========================================================
// QR DETECTADO
// =========================================================

async function qrDetectado(
    textoQR
) {

    // Evitar múltiples lecturas
    await detenerScanner();


    const resultado =
        document.getElementById(
            "resultado"
        );


    resultado.className =
        "resultado";


    resultado.innerHTML =
        "Verificando QR...";


    try {

        // Validar UUID
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


        if (
            !uuidRegex.test(
                textoQR.trim()
            )
        ) {

            throw new Error(
                "El código escaneado no es válido."
            );

        }


        // Consumir QR mediante RPC
        const { data, error } =
            await supabaseClient.rpc(
                "consumir_qr",
                {
                    p_token:
                        textoQR.trim()
                }
            );


        if (error) {

            console.error(error);

            throw new Error(
                "No se pudo verificar el QR."
            );

        }


        // =============================================
        // INGRESO AUTORIZADO
        // =============================================

        if (data.ok) {

            resultado.className =
                "resultado exito";


            resultado.innerHTML =
                `✅ ${data.mensaje}<br><br>` +
                `<strong>DNI:</strong> ${data.dni}`;


        } else {

            // =========================================
            // QR RECHAZADO
            // =========================================

            resultado.className =
                "resultado error";


            resultado.innerHTML =
                `❌ ${data.mensaje}<br><br>` +
                (
                    data.dni
                        ? `<strong>DNI:</strong> ${data.dni}`
                        : ""
                );

        }


        await actualizarDashboard();

        await cargarRegistros();


    } catch (error) {

        console.error(error);


        resultado.className =
            "resultado error";


        resultado.innerHTML =
            `❌ ${error.message}`;

    }

}


// =========================================================
// DASHBOARD
// =========================================================

async function actualizarDashboard() {

    try {

        // Total
        const {
            count: total,
            error: errorTotal
        } =
            await supabaseClient
                .from("ingresos")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                );


        if (errorTotal) {

            console.error(
                errorTotal
            );

            return;
        }


        // Ingresados
        const {
            count: ingresados,
            error: errorIngresados
        } =
            await supabaseClient
                .from("ingresos")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "estado",
                    "ingresado"
                );


        if (errorIngresados) {

            console.error(
                errorIngresados
            );

            return;
        }


        const faltantes =
            (total || 0) -
            (ingresados || 0);


        document.getElementById(
            "totalGenerados"
        ).textContent =
            total || 0;


        document.getElementById(
            "totalIngresos"
        ).textContent =
            ingresados || 0;


        document.getElementById(
            "totalFaltantes"
        ).textContent =
            faltantes;


    } catch (error) {

        console.error(error);

    }

}


// =========================================================
// CARGAR REGISTROS
// =========================================================

async function cargarRegistros() {

    const tabla =
        document.getElementById(
            "tablaRegistros"
        );


    try {

        const {
            data,
            error
        } =
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

            console.error(error);

            tabla.innerHTML =
                `<tr>
                    <td colspan="5">
                        No se pudieron cargar los registros.
                    </td>
                </tr>`;

            return;
        }


        if (
            !data ||
            data.length === 0
        ) {

            tabla.innerHTML =
                `<tr>
                    <td colspan="5">
                        No hay QRs generados.
                    </td>
                </tr>`;

            return;
        }


        tabla.innerHTML = "";


        data.forEach(
            registro => {

                const fila =
                    document.createElement(
                        "tr"
                    );


                const estado =
                    registro.estado ===
                    "ingresado"
                        ? "ingresado"
                        : "pendiente";


                const textoEstado =
                    registro.estado ===
                    "ingresado"
                        ? "Ingresado"
                        : "Pendiente";


                fila.innerHTML = `

                    <td>
                        <strong>
                            ${escapeHTML(registro.dni)}
                        </strong>
                    </td>

                    <td>

                        <span
                            class="estado estado-${estado}"
                        >
                            ${textoEstado}
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

                        <div class="acciones">

                            <button
                                class="btn-whatsapp"
                                onclick="enviarWhatsAppRegistro(
                                    '${registro.dni}',
                                    '${registro.token}'
                                )"
                            >
                                📤 Compartir
                            </button>

                            <button
                                class="btn-eliminar"
                                onclick="eliminarQR(
                                    '${registro.id}',
                                    '${registro.dni}'
                                )"
                            >
                                🗑 Borrar
                            </button>

                        </div>

                    </td>
                `;


                tabla.appendChild(
                    fila
                );

            }
        );


    } catch (error) {

        console.error(error);

        tabla.innerHTML =
            `<tr>
                <td colspan="5">
                    Error al cargar registros.
                </td>
            </tr>`;

    }

}


// =========================================================
// COMPARTIR QR DESDE TABLA
// =========================================================

async function enviarWhatsAppRegistro(
    dni,
    token
) {

    try {

        // Crear QR temporal
        const contenedor =
            document.createElement(
                "div"
            );


        contenedor.style.position =
            "fixed";

        contenedor.style.left =
            "-9999px";


        document.body.appendChild(
            contenedor
        );


        new QRCode(
            contenedor,
            {
                text: token,
                width: 250,
                height: 250,
                correctLevel:
                    QRCode.CorrectLevel.H
            }
        );


        // Esperar generación
        await esperar(300);


        const canvas =
            contenedor.querySelector(
                "canvas"
            );


        let blob = null;


        if (canvas) {

            blob =
                await new Promise(
                    resolve => {

                        canvas.toBlob(
                            resolve,
                            "image/png"
                        );

                    }
                );

        }


        // Fallback IMG
        if (!blob) {

            const img =
                contenedor.querySelector(
                    "img"
                );


            if (!img) {

                throw new Error(
                    "No se pudo generar el QR."
                );

            }


            const imagen =
                new Image();


            await new Promise(
                (
                    resolve,
                    reject
                ) => {

                    imagen.onload =
                        resolve;

                    imagen.onerror =
                        reject;

                    imagen.src =
                        img.src;

                }
            );


            const nuevoCanvas =
                document.createElement(
                    "canvas"
                );


            nuevoCanvas.width =
                imagen.naturalWidth ||
                250;


            nuevoCanvas.height =
                imagen.naturalHeight ||
                250;


            nuevoCanvas
                .getContext("2d")
                .drawImage(
                    imagen,
                    0,
                    0
                );


            blob =
                await new Promise(
                    resolve => {

                        nuevoCanvas.toBlob(
                            resolve,
                            "image/png"
                        );

                    }
                );

        }


        // Eliminar QR temporal
        document.body.removeChild(
            contenedor
        );


        if (!blob) {

            throw new Error(
                "No se pudo crear la imagen."
            );

        }


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


        const mensaje =
            `Hola 👋\n\n` +
            `Este es tu código QR de acceso.\n\n` +
            `DNI: ${dni}\n\n` +
            `Presentá este QR al momento de ingresar.\n` +
            `El código es válido para un único ingreso.`;


        // =============================================
        // COMPARTIR NATIVO
        // =============================================

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({

                title:
                    "Código QR de acceso",

                text:
                    mensaje,

                files:
                    [archivo]

            });

            return;
        }


        // =============================================
        // FALLBACK
        // =============================================

        descargarArchivo(
            blob,
            `QR_DNI_${dni}.png`
        );


        window.open(
            `https://wa.me/?text=${
                encodeURIComponent(mensaje)
            }`,
            "_blank"
        );


        alert(
            "El navegador descargó el QR porque no permite compartir archivos directamente."
        );


    } catch (error) {

        console.error(
            error
        );


        if (
            error.name === "AbortError"
        ) {

            return;
        }


        alert(
            "No se pudo compartir el QR.\n\n" +
            error.message
        );

    }

}


// =========================================================
// ELIMINAR QR
// =========================================================

async function eliminarQR(
    id,
    dni
) {

    const confirmar =
        confirm(
            `¿Seguro que querés eliminar el QR del DNI ${dni}?\n\n` +
            `El QR dejará de ser válido y no podrá utilizarse.`
        );


    if (!confirmar) {

        return;
    }


    try {

        const {
            error
        } =
            await supabaseClient
                .from("ingresos")
                .delete()
                .eq(
                    "id",
                    id
                );


        if (error) {

            console.error(error);

            alert(
                "No se pudo eliminar el QR."
            );

            return;
        }


        alert(
            `QR del DNI ${dni} eliminado correctamente.`
        );


        await cargarRegistros();

        await actualizarDashboard();


    } catch (error) {

        console.error(error);

        alert(
            "Ocurrió un error al eliminar el QR."
        );

    }

}


// =========================================================
// FECHAS
// =========================================================

function formatearFecha(
    fecha
) {

    if (!fecha) {

        return "-";
    }


    return new Date(
        fecha
    ).toLocaleString(
        "es-AR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );

}


// =========================================================
// ESPERAR
// =========================================================

function esperar(
    milisegundos
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milisegundos
            )
    );

}


// =========================================================
// SEGURIDAD BÁSICA HTML
// =========================================================

function escapeHTML(
    texto
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        texto;


    return div.innerHTML;

}