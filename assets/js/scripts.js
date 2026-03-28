// Selectores Principales
const input             = document.querySelector('#inputPesos');
const select            = document.querySelector('#selectMoneda');
const botonConvertir    = document.querySelector('#botonConvertir');
const botonHistorico    = document.querySelector('#botonHistorico');
const mostrarResultado  = document.querySelector('#resultado');

function createDivError(){
    if (document.querySelector('.divError')) return;

    const col = document.querySelector('.columna-main');

    const divError = document.createElement('div');
    divError.className = "my-3 divError";

    col.appendChild(divError);
}

// Función principal para obtener la data
async function getMonedas() {
    try {
        const apiURL = "https://mindicador.cl/api/";
        const res = await fetch(apiURL);
        const data = await res.json();

        return data;
    } catch (error) {
        // Fallback con comunicación del error
        createDivError();
        const errorDOM = document.querySelector('.divError');
        errorDOM.innerHTML = "";
        const apiURL = "./assets/json/mindicador.json";
        const res = await fetch(apiURL);
        const data = await res.json();

        errorDOM.innerHTML +=`<div class='container catch-error'>
            <p>Error al conectar con el servidor.<br>
                <strong>${error}</strong><br><br>
                <span class="status">
                    Utilizando datos con fecha: <br>
                    ${data.fecha.slice(0,10)}
                </span><br>
            </p></div>`;
        return data;
    }
}

// Formateo de los datos
async function dataClean() {
    const data = await getMonedas();
    const monedas = [];

    monedas.push(data.euro);
    monedas.push(data.dolar);
    monedas.push(data.uf);
    monedas.push(data.utm);

    monedas[1].nombre = monedas[1].nombre.slice(0,5)
    monedas[0].nombre += " (EUR)"
    monedas[1].nombre += " (USD)"
    monedas[0].simbolo = "€"
    monedas[1].simbolo = "$"
    monedas[2].simbolo = monedas[2].codigo.toUpperCase();
    monedas[3].simbolo = monedas[3].codigo.toUpperCase();

    return monedas;
}

// Renderizado de las monedas como options en el select del HTML
async function renderMonedas() {
    const monedas = await dataClean();

    let template = "";
    for(let moneda of monedas) {
        template +=`<option value="${moneda.codigo}">${moneda.nombre}</option>`
    }
    select.innerHTML += template;
}
renderMonedas();

// Funcion para realizar la conversión de monedas
async function realizarCalculo(monedaSelect) {
    const monedas = await dataClean();
    const moneda = monedas.filter((ele) => ele.codigo === monedaSelect);
    
    let valor = Number(input.value);
    if (valor < 0) {
        valor = valor * -1;
    }
    
    let resultado = (valor / (moneda[0].valor)).toFixed(2);
    mostrarResultado.innerHTML = `
        Resultado: ${
            moneda[0].codigo === 'dolar'
            ? `${moneda[0].simbolo}${resultado}`
            : `${resultado} ${moneda[0].simbolo}`
        }
    `;
}

function crearContenedorCanvas(){
    if (document.querySelector('.canvasContainer')) return;

    const row = document.querySelector('.row');
    const col = document.createElement('div');
    col.className = " col-12 col-md-10 col-lg-8 mx-auto mt-4";
    col.id = "colCanvas";

    const contenedorCanvas = document.createElement('div');
    contenedorCanvas.className = "d-flex justify-content-center canvasContainer";

    const canvas = document.createElement('canvas');
    canvas.id = "graficoMoneda";

    contenedorCanvas.appendChild(canvas);
    col.appendChild(contenedorCanvas);
    row.appendChild(col);
}

// Mostrar error en la página al no poder hacer request a todas las URL
function mostrarErrorGrafico(fechasErrorLog, fechasErrorType) {
    createDivError();
    const errorDOM = document.querySelector('.divError');
    if(errorDOM.innerHTML === ""){
        errorDOM.innerHTML += `<div class='container catch-error'></div>`;
    }    
    
    const createCanvasError = document.createElement('div');
    createCanvasError.id = "graph-error";

    const innerDivError = document.querySelector('.catch-error')
    innerDivError.appendChild(createCanvasError);

    const canvasError = document.querySelector('#graph-error')
    canvasError.innerHTML = "";

    canvasError.innerHTML += `
        <p>
            <hr class="error-hr">
            Error al obtener las fechas<br>
            <strong>${fechasErrorType[0]}</strong><br><br>
            <span class="status">No se pudo generar el gráfico de los últimos 10 días correctamente</span>
        </p>`;
    const canvas = document.querySelector('#graficoMoneda');
    const contenedorCanvas = document.querySelector('.canvasContainer');
    const colCanvas = document.querySelector('#colCanvas')
    canvas.remove();
    contenedorCanvas.remove();
    colCanvas.remove();

    
    console.log('Error al obtener las fechas:');
    console.table(fechasErrorLog);
}

// Función para hacer las múltiples request para su uso en el gráfico
async function getMonedasPasadas(codigo) {
    const resultados = [];
    const fechasErrorLog = [];
    const fechasErrorType = [];
    let ultimoValor = null;

    for (let i = 9; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i)

        const dd = String(fecha.getDate()).padStart(2, '0');
        const mm = String(fecha.getMonth() + 1).padStart(2, '0');
        const yyyy = fecha.getFullYear();
        const fechaFormateada = `${dd}-${mm}-${yyyy}`;

        const diaSemana = fecha.getDay();
        const esFinDeSemana = diaSemana === 6 || diaSemana === 0;

        if (esFinDeSemana && (ultimoValor !== null)) {
            resultados.push({ fecha: fechaFormateada, valor: ultimoValor});
            continue;
        }

        try {
            const res = await
                fetch(`https://mindicador.cl/api/${codigo}/${fechaFormateada}`)
            const data = await res.json();

            if (data.serie && data.serie.length > 0) {
                ultimoValor = data.serie[0].valor;
                resultados.push({
                    fecha: fechaFormateada,
                    valor: ultimoValor,
                });
            }
        } catch (error) {
            fechasErrorLog.push(fechaFormateada);
            fechasErrorType.push(error)
        }
    }

    if (fechasErrorLog.length > 0) {
        mostrarErrorGrafico(fechasErrorLog, fechasErrorType);
    }
    
    return resultados;
}

// Función para renderizar el gráfico y configuración del gráfico
async function renderGrafico(codigo) {
    crearContenedorCanvas();
    const datos = await getMonedasPasadas(codigo);

    const labels = datos.map((d) => d.fecha);
    const valores = datos.map((d) => d.valor);

    if (window.graficoDivisas) {
        window.graficoDivisas.destroy();
    }
    
    const canvas = document.querySelector('#graficoMoneda');
    canvas.style.backgroundColor = 'white';
    const ctx = canvas.getContext('2d');

    window.graficoDivisas = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: `${codigo.toUpperCase()} — Valores de los últimos 10 días`,
                data: valores,
                borderColor: 'red',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                pointBackgroundColor: 'white',
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Fecha'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Valor en Pesos Chilenos' // Your Y-axis label
                    }
                }
            }
        }
    });
}

// Mensajes de error para los inputs
function mensajeDeErrorUsuario(mensaje){
    mostrarResultado.innerHTML = mensaje;
    mostrarResultado.style.color = "yellow";
    setTimeout(() => {
        mostrarResultado.style.color = "white";
        mostrarResultado.innerHTML = "...";
    }, 1200);
}

// Event listener del botón convertir
botonConvertir.addEventListener('click', () => {
    // Condiciones de control para errores en el input y select
    if(!isNaN(input.value) && input.value !== "" && select.value !== "") {
        realizarCalculo(select.value);
    } else if (input.value == "") {
        mensajeDeErrorUsuario("Ingrese un valor");
    } else if (isNaN(input.value)) {
        mensajeDeErrorUsuario("Ingrese un valor numérico");
    } else if (select.value == "") {
        mensajeDeErrorUsuario("Seleccione una moneda");
    }
});

// Event listener del botón para mostrar el gráfico
botonHistorico.addEventListener('click', () => {
    // Condiciones de control para errores en select
    if(select.value !== "") {
        renderGrafico(select.value);
    } else if (select.value == "") {
        mensajeDeErrorUsuario("Seleccione una moneda");
    }
});