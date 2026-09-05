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
   VARIABLES GLOBALES
========================================================= */

let scanner = null;

let scannerActivo = false;

let ultimoTokenGenerado = null;

let ultimoDniGenerado = null;


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await actualizarDashboard();

        await cargarRegistros();

    }
);


/* =========================================================
   CAMBIAR SECCIÓN
========================================================= */

function mostrarSeccion(nombre) {

    document
        .querySelectorAll(".seccion")
        .forEach(seccion => {

            seccion.classList.remove("activa");

        });


    const seccion =
        document.getElementById(nombre);


    if (seccion) {

        seccion.classList.add("activa");

    }


    document
        .querySelectorAll(".nav-btn")
        .forEach(btn => {

            btn.classList.remove("active");

        });


    const botones =
        document.querySelectorAll(".nav-btn");


    botones.forEach(btn => {

        const texto =
            btn.textContent.toLowerCase();


        if (
            (nombre === "dashboard" && texto.includes("dashboard")) ||
            (nombre === "generar" && texto.includes("generar")) ||
            (nombre === "escanear" && texto.includes("escanear")) ||
            (nombre === "registros" && texto.includes("registros"))
        ) {

            btn.classList.add("active");

        }

    });


    if (nombre === "registros") {

        cargarRegistros();

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

        alert("Ingresá un DNI.");

        input.focus();

        return;

    }


    /*
       Evitar caracteres extraños.
    */

    if (!/^[0-9]+$/.test(dni)) {

        alert("El DNI debe contener solamente números.");

        input.focus();

        return;

    }


    /*
       Comprobar si ya existe.
    */

    const {
        data: existente,
        error: errorConsulta
    } = await supabaseClient
        .from("ingresos")
        .select("id, dni, estado")
        .eq("dni", dni)
        .maybeSingle();


    if (errorConsulta) {

        console.error(
            "Error consultando DNI:",
            errorConsulta
        );

        alert(
            "No se pudo consultar la base de datos.\n\n" +
            errorConsulta.message
        );

        return;

    }


    if (existente) {

        if (existente.estado === "ingresado") {

            alert(
                "Este DNI ya tiene un QR utilizado."
            );

        } else {

            alert(
                "Este DNI ya tiene un QR generado y pendiente."
            );

        }

        return;

    }


    /*
       Crear registro.
    */

    const {
        data,
        error
    } = await supabaseClient
        .from("ingresos")
        .insert([
            {
                dni: dni
            }
        ])
        .select()
        .single();


    if (error) {

        console.error(
            "Error generando QR:",
            error
        );

        alert(
            "No se pudo generar el QR.\n\n" +
            error.message
        );

        return;

    }


    /*
       Guardar datos globales.
    */

    ultimoTokenGenerado =
        data.token;

    ultimoDniGenerado =
        data.dni;


    /*
       Limpiar QR anterior.
    */

    const contenedorQR =
        document.getElementById("qrcode");


    contenedorQR.innerHTML = "";


    /*
       Generar QR usando el TOKEN.
       Nunca se coloca directamente el DNI.
    */

    new QRCode(
        contenedorQR,
        {
            text: data.token,

            width: 250,

            height: 250,

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );


    /*
       Mostrar DNI.
    */

    document.getElementById("dniQR")
        .textContent = data.dni;


    /*
       Mostrar contenedor.
    */

    document
        .getElementById("contenedorQR")
        .classList.remove("oculto");


    /*
       Limpiar campo.
    */

    input.value = "";


    /*
       Actualizar dashboard.
    */

    await actualizarDashboard();

    await cargarRegistros();

}


/* =========================================================
   DESCARGAR QR
========================================================= */

function descargarQR() {

    const qr =
        document.querySelector(
            "#qrcode img"
        );


    if (!qr) {

        alert("No hay un QR generado.");

        return;

    }


    const canvas =
        document.createElement("canvas");


    const ctx =
        canvas.getContext("2d");


    const imagen =
        new Image();


    imagen.crossOrigin = "anonymous";


    imagen.onload = function () {

        const margen = 30;

        canvas.width =
            imagen.width + margen * 2;

        canvas.height =
            imagen.height + margen * 2;


        ctx.fillStyle = "#ffffff";

        ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        ctx.drawImage(
            imagen,
            margen,
            margen
        );


        const enlace =
            document.createElement("a");


        enlace.download =
            `QR_DNI_${ultimoDniGenerado}.png`;


        enlace.href =
            canvas.toDataURL("image/png");


        enlace.click();

    };


    imagen.src = qr.src;

}


/* =========================================================
   COMPARTIR / WHATSAPP
========================================================= */

if (!ultimoTokenGenerado || !ultimoDniGenerado) {
        alert("Primero generá un QR.");
        return;
    }

    const qrImg = document.querySelector("#qrcode img");

    if (!qrImg) {
        alert("No se encontró la imagen del QR.");
        return;
    }

    try {

        // Convertir la imagen del QR en Blob
        const response = await fetch(qrImg.src);

        if (!response.ok) {
            throw new Error("No se pudo obtener la imagen del QR.");
        }

        const blob = await response.blob();

        // Crear archivo PNG
        const archivo = new File(
            [blob],
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

        /*
         * Comprobar si el navegador permite
         * compartir archivos.
         */

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [archivo]
            })
        ) {

            await navigator.share({
                title: "Código QR de acceso",
                text: mensaje,
                files: [archivo]
            });

            return;
        }

        /*
         * Si estamos en PC o el navegador no admite
         * compartir archivos, descargamos automáticamente
         * el QR y abrimos WhatsApp con el mensaje.
         */

        descargarArchivoQR(blob);

        const whatsappURL =
            `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

        window.open(
            whatsappURL,
            "_blank"
        );

        alert(
            "El QR fue descargado automáticamente.\n\n" +
            "Adjuntalo en la conversación de WhatsApp."
        );

    } catch (error) {

        console.error(
            "Error compartiendo QR:",
            error
        );

        alert(
            "No se pudo compartir el QR.\n\n" +
            error.message
        );
    }

    function descargarArchivoQR(blob) {

    const url =
        URL.createObjectURL(blob);

    const enlace =
        document.createElement("a");

    enlace.href = url;

    enlace.download =
        `QR_DNI_${ultimoDniGenerado}.png`;

    document.body.appendChild(enlace);

    enlace.click();

    document.body.removeChild(enlace);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}
/* =========================================================
   INICIAR SCANNER
========================================================= */

async function iniciarScanner() {

    if (scannerActivo) {

        return;

    }


    document
        .getElementById("resultadoIngreso")
        .innerHTML = "";


    scanner =
        new Html5Qrcode("reader");


    try {

        await scanner.start(

            {
                facingMode: "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }

            },

            qrDetectado,

            () => {
                // Ignoramos errores de lectura
            }

        );


        scannerActivo = true;


        document
            .getElementById(
                "btnIniciarScanner"
            )
            .classList.add("oculto");


        document
            .getElementById(
                "btnDetenerScanner"
            )
            .classList.remove("oculto");


    } catch (error) {

        console.error(
            "Error iniciando cámara:",
            error
        );


        alert(
            "No se pudo iniciar la cámara.\n\n" +
            "Verificá que el navegador tenga permiso " +
            "para utilizar la cámara."
        );

    }

}


/* =========================================================
   QR DETECTADO
========================================================= */

let procesandoQR = false;


async function qrDetectado(
    textoQR
) {

    if (procesandoQR) {

        return;

    }


    procesandoQR = true;


    /*
       Detener temporalmente
       para evitar múltiples lecturas.
    */

    await detenerScanner();


    const resultado =
        document.getElementById(
            "resultadoIngreso"
        );


    resultado.innerHTML =
        "⏳ Verificando QR...";


    try {

        /*
           Validamos que sea UUID.
        */

        if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                .test(textoQR.trim())
        ) {

            resultado.className =
                "resultado error";


            resultado.innerHTML =
                "❌ QR inválido";


            procesandoQR = false;

            return;

        }


        /*
           Consumir QR mediante RPC.
        */

        const {
            data,
            error
        } = await supabaseClient
            .rpc(
                "consumir_qr",
                {
                    p_token:
                        textoQR.trim()
                }
            );


        if (error) {

            console.error(
                "Error consumiendo QR:",
                error
            );


            resultado.className =
                "resultado error";


            resultado.innerHTML =
                "❌ Error al verificar el QR.<br>" +
                error.message;


            procesandoQR = false;

            return;

        }


        /*
           QR válido.
        */

        if (data.ok) {

            resultado.className =
                "resultado exito";


            resultado.innerHTML = `
                <div style="font-size:35px;">
                    ✅
                </div>

                <div style="font-size:22px; margin:10px;">
                    INGRESO AUTORIZADO
                </div>

                <div>
                    DNI:
                    <strong>
                        ${data.dni}
                    </strong>
                </div>

                <div style="margin-top:8px; font-size:13px;">
                    ${formatearFecha(
                        data.ingresado_en
                    )}
                </div>
            `;


            await actualizarDashboard();

            await cargarRegistros();


        } else {

            resultado.className =
                "resultado error";


            resultado.innerHTML = `
                <div style="font-size:35px;">
                    ❌
                </div>

                <div style="font-size:20px; margin:10px;">
                    ${data.mensaje}
                </div>

                ${
                    data.dni
                        ? `<div>DNI: <strong>${data.dni}</strong></div>`
                        : ""
                }

                ${
                    data.ingresado_en
                        ? `
                            <div style="margin-top:8px;">
                                Utilizado:
                                ${formatearFecha(
                                    data.ingresado_en
                                )}
                            </div>
                          `
                        : ""
                }
            `;

        }


    } catch (error) {

        console.error(
            "Error:",
            error
        );


        resultado.className =
            "resultado error";


        resultado.innerHTML =
            "❌ Ocurrió un error al procesar el QR.";

    }


    /*
       Permitir volver a escanear.
    */

    procesandoQR = false;

}


/* =========================================================
   DETENER SCANNER
========================================================= */

async function detenerScanner() {

    if (
        scanner &&
        scannerActivo
    ) {

        try {

            await scanner.stop();

            scanner.clear();

        } catch (error) {

            console.warn(
                "Error deteniendo scanner:",
                error
            );

        }

    }


    scannerActivo = false;

    scanner = null;


    const iniciar =
        document.getElementById(
            "btnIniciarScanner"
        );


    const detener =
        document.getElementById(
            "btnDetenerScanner"
        );


    if (iniciar) {

        iniciar.classList.remove(
            "oculto"
        );

    }


    if (detener) {

        detener.classList.add(
            "oculto"
        );

    }

}


/* =========================================================
   ELIMINAR QR
========================================================= */

async function eliminarQR(
    id,
    dni
) {

    const confirmar =
        confirm(
            `¿Seguro que querés eliminar el QR del DNI ${dni}?\n\n` +
            `El QR dejará de existir y ya no podrá utilizarse.`
        );


    if (!confirmar) {

        return;

    }


    const {
        error
    } = await supabaseClient
        .from("ingresos")
        .delete()
        .eq("id", id);


    if (error) {

        console.error(
            "Error eliminando:",
            error
        );


        alert(
            "No se pudo eliminar el QR.\n\n" +
            error.message
        );

        return;

    }


    alert(
        `QR del DNI ${dni} eliminado correctamente.`
    );


    await cargarRegistros();

    await actualizarDashboard();

}


/* =========================================================
   CARGAR REGISTROS
========================================================= */

async function cargarRegistros() {

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

        console.error(
            "Error cargando registros:",
            error
        );


        const tabla =
            document.getElementById(
                "tablaRegistros"
            );


        tabla.innerHTML = `
            <tr>
                <td colspan="5">
                    No se pudieron cargar los registros.
                </td>
            </tr>
        `;


        return;

    }


    const tabla =
        document.getElementById(
            "tablaRegistros"
        );


    tabla.innerHTML = "";


    if (!data || data.length === 0) {

        tabla.innerHTML = `
            <tr>
                <td colspan="5">
                    No hay registros.
                </td>
            </tr>
        `;


        return;

    }


    data.forEach(
        registro => {

            const tr =
                document.createElement("tr");


            const estadoTexto =
                registro.estado === "ingresado"
                    ? "INGRESÓ"
                    : "PENDIENTE";


            const estadoClase =
                registro.estado === "ingresado"
                    ? "estado-ingresado"
                    : "estado-pendiente";


            tr.innerHTML = `

                <td>
                    <strong>
                        ${registro.dni}
                    </strong>
                </td>


                <td>

                    <span
                        class="${estadoClase}"
                    >
                        ${estadoTexto}
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
                            📱 WhatsApp
                        </button>


                        <button
                            class="btn-eliminar"
                            onclick="eliminarQR(
                                '${registro.id}',
                                '${registro.dni}'
                            )"
                        >
                            🗑️ Borrar
                        </button>

                    </div>

                </td>

            `;


            tabla.appendChild(tr);

        }
    );

}


/* =========================================================
   WHATSAPP DESDE REGISTROS
========================================================= */

async function enviarWhatsAppRegistro(
    dni,
    token
) {

    /*
       Generamos temporalmente el QR
       para poder compartirlo.
    */

    const temporal =
        document.createElement("div");


    temporal.style.position =
        "fixed";

    temporal.style.left =
        "-9999px";

    document.body.appendChild(
        temporal
    );


    new QRCode(
        temporal,
        {
            text: token,

            width: 250,

            height: 250,

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );


    /*
       Esperamos a que aparezca la imagen.
    */

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                300
            )
    );


    const qr =
        temporal.querySelector("img");


    if (!qr) {

        temporal.remove();

        alert(
            "No se pudo generar la imagen del QR."
        );

        return;

    }


    const texto =
        `Hola 👋\n\n` +
        `Este es tu código QR de acceso.\n\n` +
        `DNI: ${dni}\n\n` +
        `Presentá este QR al momento de ingresar.\n` +
        `El código es válido para un único ingreso.`;


    try {

        const response =
            await fetch(qr.src);


        const blob =
            await response.blob();


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
                    "Código QR de acceso",

                text:
                    texto,

                files:
                    [archivo]

            });

        } else {

            /*
               Fallback para PC:
               abrir WhatsApp con texto.
            */

            const mensaje =
                encodeURIComponent(texto);


            window.open(
                `https://wa.me/?text=${mensaje}`,
                "_blank"
            );


            alert(
                "El navegador no permite compartir " +
                "automáticamente la imagen.\n\n" +
                "Podés descargar el QR desde la sección " +
                "Generar QR y adjuntarlo manualmente."
            );

        }


    } catch (error) {

        console.error(
            error
        );


        const mensaje =
            encodeURIComponent(texto);


        window.open(
            `https://wa.me/?text=${mensaje}`,
            "_blank"
        );

    }


    temporal.remove();

}


/* =========================================================
   DASHBOARD
========================================================= */

async function actualizarDashboard() {

    /*
       Total generados
    */

    const {
        count: total,
        error: errorTotal
    } = await supabaseClient
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
            "Error obteniendo total:",
            errorTotal
        );

        return;

    }


    /*
       Total ingresos
    */

    const {
        count: ingresos,
        error: errorIngresos
    } = await supabaseClient
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


    if (errorIngresos) {

        console.error(
            "Error obteniendo ingresos:",
            errorIngresos
        );

        return;

    }


    const faltantes =
        Math.max(
            0,
            (total || 0) -
            (ingresos || 0)
        );


    document.getElementById(
        "totalGenerados"
    ).textContent =
        total || 0;


    document.getElementById(
        "totalIngresos"
    ).textContent =
        ingresos || 0;


    document.getElementById(
        "totalFaltantes"
    ).textContent =
        faltantes;

}


/* =========================================================
   FORMATEAR FECHA
========================================================= */

function formatearFecha(
    fecha
) {

    if (!fecha) {

        return "-";

    }


    const fechaObj =
        new Date(fecha);


    return fechaObj.toLocaleString(
        "es-AR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );

}


/* =========================================================
   IMPRIMIR QR
========================================================= */

function imprimirQR() {

    const qr =
        document.getElementById(
            "contenedorQR"
        );


    if (
        !qr ||
        qr.classList.contains("oculto")
    ) {

        alert(
            "Primero generá un QR."
        );

        return;

    }


    window.print();

}