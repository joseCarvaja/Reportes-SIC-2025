
document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const messageBox = document.getElementById('message-box');
    const analysisSectionsEl = document.getElementById('analysis-sections');
    const tablaTodosContratosBody = document.getElementById('tabla-todos-contratos-body');
    const contenedorTablaValidos = document.getElementById('contenedor-tabla-validos');
    const toggleTablaValidos = document.getElementById('toggle-tabla-validos');
    const seccionContratosRechazados = document.getElementById('seccion-contratos-rechazados');
    const tablaRechazadosBody = document.getElementById('tabla-rechazados-body');
    const contenedorTablaRechazados = document.getElementById('contenedor-tabla-rechazados');
    const toggleTablaRechazados = document.getElementById('toggle-tabla-rechazados');
    const drilldownSectionEl = document.getElementById('drilldown-section');
    const drilldownTitleEl = document.getElementById('drilldown-title');
    const drilldownTableBodyEl = document.getElementById('drilldown-table-body');
    const toggleTablaDrilldown = document.getElementById('toggle-tabla-drilldown'); 
    const contenedorTablaDrilldown = document.getElementById('contenedor-tabla-drilldown');
    const totalContratosValidosEl = document.getElementById('total-contratos-validos');
    const montoTotalGeneralEl = document.getElementById('monto-total-general');
    const contratistasUnicosEl = document.getElementById('contratistas-unicos');
    const contratosEnEjecucionEl = document.getElementById('contratos-en-ejecucion');
    const totalContratosRechazadosEl = document.getElementById('total-contratos-rechazados');
    const tablaMultiContratistasBody = document.getElementById('tabla-multi-contratistas-body');
    const contenedorTablaMultiContratistas = document.getElementById('contenedor-tabla-multi-contratistas');
    const toggleTablaMultiContratistas = document.getElementById('toggle-tabla-multi-contratistas');
    const tituloMultiContratistasEl = document.getElementById('titulo-multi-contratistas'); 
    const tablaResumenDependenciaBody = document.getElementById('tabla-resumen-dependencia-body');

    let chartTopContratistas = null;
    let chartValorPorDependencia = null;
    let chartCantidadPorDependencia = null;

    let _contratosValidosGlobal = []; 
    let _multiContratistasArrayGlobalData = []; 
    let _dependenciasArrayGlobalData = [];   
    let _docSecopContratistasFrecuentesGlobal = new Set();
    
    // Sistema de filtros globales
    let _filtroGlobalActivo = null; // {tipo: 'contratista'|'area', valor: string, nombre: string}

    const COL_IDX = {
        NUMERO_CTO: 0, ESTADO_SECOP: 1, NOMBRE_CONTRATISTA: 2, DOCUMENTO_NUM: 3,
        DOCUMENTO_SECOP: 4, CEDIDO: 5, AREA_DELEGATURA: 6, HONORARIOS: 7,
        VALOR_CONTRATO: 8, PLAZO_DIAS: 9, APROBADO: 10, FECHA_APROBACION: 11,
        FECHA_FIRMA_SECOP: 12
    };
    const NUM_COLUMNAS_ESPERADAS = Object.keys(COL_IDX).length;

    // --- Utility Functions ---
    function showMessage(message, type = 'info') {
        if (messageBox) {
            messageBox.textContent = message;
            messageBox.className = 'mt-3 p-3 rounded-md text-sm';
            messageBox.classList.remove('hidden');
            if (type === 'error') messageBox.classList.add('bg-red-100', 'text-red-700', 'border-l-4', 'border-red-500');
            else if (type === 'success') messageBox.classList.add('bg-green-100', 'text-green-700', 'border-l-4', 'border-green-500');
            else messageBox.classList.add('bg-blue-100', 'text-blue-700', 'border-l-4', 'border-blue-500');
            
            setTimeout(() => {
                if (messageBox && type !== 'error') {
                    messageBox.classList.add('hidden');
                }
            }, 5000);
        }
    }

    function formatCurrency(value) {
        const num = parseFloat(value);
        if (isNaN(num)) return '$0';
        return new Intl.NumberFormat('es-CO', { 
            style: 'currency', 
            currency: 'COP', 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        }).format(num);
    }

    function parseNumberWithPotentialSeparators(valueStr, columnNameForLog = "Value") {
        if (typeof valueStr === 'number') return valueStr;
        if (typeof valueStr !== 'string') valueStr = String(valueStr);
        let originalInputForLog = valueStr;
        valueStr = valueStr.trim();
        if (valueStr === "") { return NaN; }
        let cleanedValue = valueStr.replace(/[$\sA-Za-zCOPcop]/gi, ''); 
        if (cleanedValue.trim() === "") { return NaN; }
        let finalStringToParse = cleanedValue;
        const hasComma = cleanedValue.includes(',');
        const hasDot = cleanedValue.includes('.');
        if (hasComma && /,\d{1,2}$/.test(cleanedValue)) { 
            finalStringToParse = cleanedValue.replace(/\./g, ''); 
            finalStringToParse = finalStringToParse.replace(/,/g, '.');  
        } else if (hasDot && !hasComma) { 
            const parts = cleanedValue.split('.');
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1];
                if (parts.length > 2 || (lastPart.length !== 1 && lastPart.length !== 2 && lastPart.length !== 0)) {
                    finalStringToParse = cleanedValue.replace(/\./g, '');
                }
            }
        } else if (hasComma && !hasDot) { 
            if ((cleanedValue.match(/,/g) || []).length > 1) {
                finalStringToParse = cleanedValue.replace(/,/g, ''); 
            } else { 
                finalStringToParse = cleanedValue.replace(/,/g, '.');
            }
        } else if (hasComma && hasDot) { 
            if (cleanedValue.lastIndexOf(',') > cleanedValue.lastIndexOf('.')) {
                finalStringToParse = cleanedValue.replace(/\./g, ''); 
                finalStringToParse = finalStringToParse.replace(/,/g, '.');  
            } else { 
                finalStringToParse = cleanedValue.replace(/,/g, ''); 
            }
        }
        const num = parseFloat(finalStringToParse);
        if (isNaN(num) && finalStringToParse !== "") { 
             console.error(`parseNumber (${columnNameForLog}): FALLÓ PARSEO! Original='${originalInputForLog}', ProcesadoA='${finalStringToParse}', resultó en NaN.`);
        }
        return num;
    }

    function parseCSV(text) {
        if (!text || text.trim() === '') { console.warn("CSV text is empty."); return []; }
        const lines = text.split(/\r\n|\n/); 
        const nonEmptyLines = lines.filter(line => line.trim() !== ''); 
        if (nonEmptyLines.length === 0) { console.warn("CSV no tiene líneas con contenido."); return []; }
        let delimiter = ';'; 
        const firstLineToInspect = nonEmptyLines[0]; 
        const commaCount = (firstLineToInspect.match(/,/g) || []).length;
        const semicolonCount = (firstLineToInspect.match(/;/g) || []).length;
        if (commaCount > semicolonCount && semicolonCount === 0) { delimiter = ','; } 
        else if (semicolonCount > 0) { delimiter = ';'; } 
        else { delimiter = ','; }
        
        const rows = [];
        nonEmptyLines.forEach((line) => {
            const row = [];
            let currentField = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && i + 1 < line.length && line[i+1] === '"') { currentField += '"'; i++; } 
                    else { inQuotes = !inQuotes; }
                } else if (char === delimiter && !inQuotes) {
                    row.push(currentField.trim()); currentField = '';
                } else { currentField += char; }
            }
            row.push(currentField.trim());
            rows.push(row);
        });
        return rows;
    }

    function populateContractsTable(tbodyElement, contractsArray) {
        tbodyElement.innerHTML = ''; 
        if (!contractsArray || contractsArray.length === 0) {
            tbodyElement.innerHTML = `<tr><td colspan="${NUM_COLUMNAS_ESPERADAS}" class="text-center p-8 text-gray-500">No hay contratos para mostrar con este filtro.</td></tr>`;
            return false; 
        }
        contractsArray.forEach((contrato, index) => {
            const filaEl = tbodyElement.insertRow();
            filaEl.className = index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100';
            filaEl.innerHTML = `
                <td class="px-3 py-2 text-sm">${contrato.numeroCto}</td>
                <td class="px-3 py-2 text-sm font-medium estado-cell" data-estado="${contrato.estadoSecop}">${contrato.estadoSecop}</td>
                <td class="px-3 py-2 text-sm">${contrato.nombreContratista}</td>
                <td class="px-3 py-2 text-sm">${contrato.documentoNum}</td>
                <td class="px-3 py-2 text-sm font-mono">${contrato.documentoSecop}</td>
                <td class="px-3 py-2 text-sm">${contrato.cedido}</td>
                <td class="px-3 py-2 text-sm">${contrato.dependencia}</td>
                <td class="px-3 py-2 text-sm text-right font-medium">${formatCurrency(contrato.honorarios)}</td>
                <td class="px-3 py-2 text-sm text-right font-bold">${formatCurrency(contrato.valorContrato)}</td>
                <td class="px-3 py-2 text-sm text-center">${contrato.plazoDias}</td>
                <td class="px-3 py-2 text-sm">${contrato.aprobado}</td>
                <td class="px-3 py-2 text-sm">${contrato.fechaAprobacion}</td>
                <td class="px-3 py-2 text-sm">${contrato.fechaFirmaSecop}</td>
            `;
            
            const estadoCell = filaEl.querySelector('.estado-cell');
            if (contrato.estadoSecop.includes('rechazad') || contrato.estadoSecop.includes('anulad')) {
                estadoCell.classList.add('text-red-700', 'bg-red-100', 'px-2', 'py-1', 'rounded');
            } else if (contrato.estadoSecop.includes('ejecución')) {
                estadoCell.classList.add('text-orange-700', 'bg-orange-100', 'px-2', 'py-1', 'rounded');
            } else if (contrato.estadoSecop.includes('terminado') || contrato.estadoSecop.includes('liquidado') || contrato.estadoSecop.includes('firmado')) { 
                estadoCell.classList.add('text-green-700', 'bg-green-100', 'px-2', 'py-1', 'rounded');
            }
        });
        return true; 
    }

    function displayDrilldownTable(filteredContracts, title) {
        if(drilldownTitleEl) drilldownTitleEl.textContent = title;
        populateContractsTable(drilldownTableBodyEl, filteredContracts); 

        if(drilldownSectionEl) drilldownSectionEl.classList.remove('hidden');
        if(contenedorTablaDrilldown) contenedorTablaDrilldown.classList.remove('hidden'); 
        if(toggleTablaDrilldown) toggleTablaDrilldown.textContent = 'Cerrar Detalle';
        if(drilldownSectionEl) drilldownSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function procesarDatos(parsedData) {
        console.log("== INICIO NUEVO PROCESAMIENTO DE DATOS CSV ==");
        _contratosValidosGlobal = []; 
        _multiContratistasArrayGlobalData = [];
        _dependenciasArrayGlobalData = [];
        _docSecopContratistasFrecuentesGlobal = new Set();

        if (!parsedData || parsedData.length < 2) { 
            showMessage('El texto CSV está vacío o solo tiene encabezado.', 'error');
            actualizarResumenesGlobales([],[],0,0,0);
            if(analysisSectionsEl) analysisSectionsEl.classList.add('hidden');
            return;
        }
        const headerRowCSV = parsedData[0];
        const dataRows = parsedData.slice(1);
        console.log(`Procesando ${dataRows.length} filas de datos (sin encabezado).`);

        const contratosActivosYTerminados = [];
        const contratosRechazados = [];
        let montoTotalGeneralValidos = 0;
        let contratosEnEjecucionCountValidos = 0;
        const docSecopContratistasSetValidos = new Set();
        let erroresDeProcesamiento = 0;

        dataRows.forEach((row, index) => {
            try {
                if (row.length < NUM_COLUMNAS_ESPERADAS) { 
                    console.warn(`Fila ${index + 1} (datos) incompleta (${row.length} cols, esperaba ${NUM_COLUMNAS_ESPERADAS}). Omitida.`);
                    erroresDeProcesamiento++;
                    return; 
                }
                const estadoSecopOriginal = String(row[COL_IDX.ESTADO_SECOP] || '').trim().toLowerCase();
                const contrato = {
                    numeroCto: String(row[COL_IDX.NUMERO_CTO] || 'N/A').trim(),
                    estadoSecop: estadoSecopOriginal,
                    nombreContratista: String(row[COL_IDX.NOMBRE_CONTRATISTA] || 'Desconocido').trim(),
                    documentoNum: String(row[COL_IDX.DOCUMENTO_NUM] || 'N/A').trim(),
                    documentoSecop: String(row[COL_IDX.DOCUMENTO_SECOP] || 'Desconocido_SECOP').trim(),
                    cedido: String(row[COL_IDX.CEDIDO] || 'N/A').trim(),
                    dependencia: String(row[COL_IDX.AREA_DELEGATURA] || 'Desconocida').trim(),
                    honorarios: parseNumberWithPotentialSeparators(String(row[COL_IDX.HONORARIOS] || '0'), `Fila ${index+1} HONORARIOS`),
                    valorContrato: parseNumberWithPotentialSeparators(String(row[COL_IDX.VALOR_CONTRATO] || '0'), `Fila ${index+1} VALOR_CONTRATO`),
                    plazoDias: String(row[COL_IDX.PLAZO_DIAS] || 'N/A').trim(),
                    aprobado: String(row[COL_IDX.APROBADO] || 'N/A').trim().toLowerCase(),
                    fechaAprobacion: String(row[COL_IDX.FECHA_APROBACION] || 'N/A').trim(),
                    fechaFirmaSecop: String(row[COL_IDX.FECHA_FIRMA_SECOP] || 'N/A').trim(),
                };
                if (contrato.estadoSecop.includes('rechazad') || contrato.estadoSecop.includes('anulad')) {
                    contratosRechazados.push(contrato);
                } else {
                    contratosActivosYTerminados.push(contrato);
                    if (!isNaN(contrato.valorContrato)) montoTotalGeneralValidos += contrato.valorContrato;
                    if(contrato.documentoSecop !== 'Desconocido_SECOP' && contrato.documentoSecop !== '') {
                        docSecopContratistasSetValidos.add(contrato.documentoSecop);
                    }
                    if (contrato.estadoSecop.includes('ejecución')) contratosEnEjecucionCountValidos++;
                }
            } catch (e) {
                console.error(`Error fatal procesando fila ${index + 1} del CSV. Fila:`, JSON.stringify(row), "Error:", e);
                erroresDeProcesamiento++;
            }
        });

        console.log(`DEVLOG: Errores durante el procesamiento de filas individuales: ${erroresDeProcesamiento}`);
        _contratosValidosGlobal = [...contratosActivosYTerminados]; 

        if (!populateContractsTable(tablaTodosContratosBody, _contratosValidosGlobal)) {
             if(contenedorTablaValidos) contenedorTablaValidos.classList.add('hidden');
             if(toggleTablaValidos) toggleTablaValidos.textContent = 'Mostrar Detalles (Válidos)';
        }
        if (populateContractsTable(tablaRechazadosBody, contratosRechazados)) {
            if(seccionContratosRechazados) seccionContratosRechazados.style.display = 'block';
        } else {
            if(seccionContratosRechazados) seccionContratosRechazados.style.display = 'none';
        }

        actualizarResumenesGlobales(
            _contratosValidosGlobal, contratosRechazados, 
            montoTotalGeneralValidos, docSecopContratistasSetValidos.size, contratosEnEjecucionCountValidos
        );

        if (_contratosValidosGlobal.length > 0) {
            procesarAgregadosYGraficos(_contratosValidosGlobal);
            if(analysisSectionsEl) analysisSectionsEl.classList.remove('hidden');
        } else { 
            if(analysisSectionsEl) analysisSectionsEl.classList.add('hidden'); 
            if(tablaMultiContratistasBody) tablaMultiContratistasBody.innerHTML = `<tr><td colspan="4" class="text-center p-4">No hay datos válidos para este análisis.</td></tr>`;
            if(tablaResumenDependenciaBody) tablaResumenDependenciaBody.innerHTML = `<tr><td colspan="4" class="text-center p-4">No hay datos válidos para este análisis.</td></tr>`;
            const chart1El = document.getElementById('chartTopContratistas');
            const chart2El = document.getElementById('chartValorPorDependencia');
            const chart3El = document.getElementById('chartCantidadPorDependencia');
            if (chartTopContratistas) { chartTopContratistas.destroy(); chartTopContratistas = null; if(chart1El) chart1El.parentElement.style.display = 'none';}
            if (chartValorPorDependencia) { chartValorPorDependencia.destroy(); chartValorPorDependencia = null; if(chart2El) chart2El.parentElement.style.display = 'none';}
            if (chartCantidadPorDependencia) { chartCantidadPorDependencia.destroy(); chartCantidadPorDependencia = null; if(chart3El) chart3El.parentElement.style.display = 'none';}
        }
        showMessage(`Procesamiento completo. Válidos: ${_contratosValidosGlobal.length}, Rechazados: ${contratosRechazados.length}. Errores en filas: ${erroresDeProcesamiento}.`, 'success');
        console.log("== FIN PROCESAMIENTO DE DATOS CSV ==");
    }

    function actualizarResumenesGlobales(contratosValidos, contratosRechaz, montoTotalValidos, numContratistasUnicosValidos, numEnEjecucionValidos) {
        console.log("DEVLOG: actualizarResumenesGlobales - Input Data:", {
            cvL: contratosValidos ? contratosValidos.length : 0, crL: contratosRechaz ? contratosRechaz.length : 0,
            mTV: montoTotalValidos, nCUV: numContratistasUnicosValidos, nEEV: numEnEjecucionValidos
        });
        if (totalContratosValidosEl) totalContratosValidosEl.textContent = (contratosValidos ? contratosValidos.length : 0).toString(); 
        if (totalContratosRechazadosEl) totalContratosRechazadosEl.textContent = (contratosRechaz ? contratosRechaz.length : 0).toString(); 
        if (montoTotalGeneralEl) montoTotalGeneralEl.textContent = formatCurrency(montoTotalValidos); 
        if (contratistasUnicosEl) contratistasUnicosEl.textContent = (numContratistasUnicosValidos || 0).toString(); 
        // La tarjeta "En Ejecución" se actualiza en procesarAgregadosYGraficos
    }

    function actualizarTarjetaEnEjecucion(cantidadContratistasMultiples) {
        if (contratosEnEjecucionEl) contratosEnEjecucionEl.textContent = cantidadContratistasMultiples.toString();
    }

    function populateMultiContractorTable(dataArray) {
        const tituloOriginal = "Contratistas con Múltiples Contratos (por Doc. SECOP, Basado en Contratos Válidos)";
        let tituloActualHTML = "";
         if(tituloMultiContratistasEl) {
            tituloActualHTML = tituloMultiContratistasEl.dataset.isFiltered === "true" ? 
                                tituloMultiContratistasEl.innerHTML.split(" <button")[0] : 
                                tituloOriginal;
            if (tituloMultiContratistasEl.dataset.isFiltered === "true") {
                tituloActualHTML += ` <button id="reset-multi-contractor-filter-btn" class="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-md text-xs ml-2 transition-colors">Mostrar Todos</button>`;
            }
            tituloMultiContratistasEl.innerHTML = tituloActualHTML;
        }

        const resetButton = document.getElementById('reset-multi-contractor-filter-btn');
        if (resetButton) {
            const newButton = resetButton.cloneNode(true); 
            resetButton.parentNode.replaceChild(newButton, resetButton);
            newButton.addEventListener('click', () => {
                if(tituloMultiContratistasEl) tituloMultiContratistasEl.dataset.isFiltered = "false";
                populateMultiContractorTable(_multiContratistasArrayGlobalData); 
            });
        }
        tablaMultiContratistasBody.innerHTML = '';
        if (dataArray.length > 0) {
            dataArray.forEach((data, index) => {
                 const row = tablaMultiContratistasBody.insertRow();
                 row.className = `${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer transition-colors`;
                 row.setAttribute('data-doc-secop', data.documentoSecop); 
                 row.setAttribute('data-nombre-display', data.nombreDisplay); 
                row.innerHTML = `
                    <td class="px-3 py-2 text-sm font-mono">${data.documentoSecop}</td>
                    <td class="px-3 py-2 text-sm">${data.nombreDisplay}</td>
                    <td class="px-3 py-2 text-sm text-center font-medium">${data.count}</td>
                    <td class="px-3 py-2 text-sm text-right font-bold">${formatCurrency(data.totalValue)}</td>
                `;
            });
        } else { 
            tablaMultiContratistasBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">No hay contratistas para los criterios actuales.</td></tr>`;
        }
    }
    
    function filterAndDisplayMultiContractorsByArea(areaNombre) {
        const filteredMultiContractors = _multiContratistasArrayGlobalData.filter(contractorData => {
            return _contratosValidosGlobal.some(c => 
                c.documentoSecop === contractorData.documentoSecop && 
                c.dependencia === areaNombre
            );
        });
        if(tituloMultiContratistasEl) {
            tituloMultiContratistasEl.dataset.isFiltered = "true";
            tituloMultiContratistasEl.innerHTML = `Contratistas con Múltiples Contratos en Área: <span class="text-blue-600 font-semibold">${areaNombre}</span>`;
        }
        populateMultiContractorTable(filteredMultiContractors); 
        if(contenedorTablaMultiContratistas) contenedorTablaMultiContratistas.classList.remove('hidden');
        if(toggleTablaMultiContratistas) toggleTablaMultiContratistas.textContent = 'Ocultar Detalles';
        const seccionMultiContratistas = document.getElementById('seccion-multi-contratistas');
        if(seccionMultiContratistas) seccionMultiContratistas.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    function procesarAgregadosYGraficos(contratosValidos) {
        const contratistasData = {}; 
        contratosValidos.forEach(c => {
            if (c.documentoSecop === 'Desconocido_SECOP' || c.documentoSecop === '') return;
            if (!contratistasData[c.documentoSecop]) {
                contratistasData[c.documentoSecop] = { nombreDisplay: c.nombreContratista, count: 0, totalValue: 0, dependencias: new Set() };
            }
            contratistasData[c.documentoSecop].count++;
            if(!isNaN(c.valorContrato)){ contratistasData[c.documentoSecop].totalValue += c.valorContrato; } 
            if(c.dependencia !== 'Desconocida' && c.dependencia !== '') contratistasData[c.documentoSecop].dependencias.add(c.dependencia);
        });
        _multiContratistasArrayGlobalData = Object.entries(contratistasData)
            .filter(([, data]) => data.count > 1)
            .map(([docSecop, data]) => ({ documentoSecop: docSecop, ...data }))
            .sort((a, b) => b.totalValue - a.totalValue); 
        if(tituloMultiContratistasEl) tituloMultiContratistasEl.dataset.isFiltered = "false";
        populateMultiContractorTable(_multiContratistasArrayGlobalData);
        _docSecopContratistasFrecuentesGlobal = new Set(_multiContratistasArrayGlobalData.map(mc => mc.documentoSecop));
        const resumenDependenciasData = {};
        contratosValidos.forEach(c => {
            if (_docSecopContratistasFrecuentesGlobal.has(c.documentoSecop) && c.dependencia !== 'Desconocida' && c.dependencia !== '') {
                if (!resumenDependenciasData[c.dependencia]) { resumenDependenciasData[c.dependencia] = { contratistasUnicos: new Set(), countContratos: 0, totalValue: 0 };}
                resumenDependenciasData[c.dependencia].contratistasUnicos.add(c.documentoSecop); 
                resumenDependenciasData[c.dependencia].countContratos++;
                if(!isNaN(c.valorContrato)) resumenDependenciasData[c.dependencia].totalValue += c.valorContrato;
            }
        });
        
        // Actualizar tarjeta "En Ejecución" con cantidad de contratistas con múltiples contratos
        actualizarTarjetaEnEjecucion(_multiContratistasArrayGlobalData.length);
        _dependenciasArrayGlobalData = Object.entries(resumenDependenciasData)
            .map(([nombre, data]) => ({ nombre, ...data }))
            .sort((a,b) => b.totalValue - a.totalValue);
        tablaResumenDependenciaBody.innerHTML = '';
        if (_dependenciasArrayGlobalData.length > 0) {
            _dependenciasArrayGlobalData.forEach((data, index) => { 
                const row = tablaResumenDependenciaBody.insertRow();
                row.className = `${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 cursor-pointer transition-colors`;
                row.setAttribute('data-area-nombre', data.nombre); 
                row.innerHTML = `
                    <td class="px-3 py-2 text-sm font-medium">${data.nombre}</td>
                    <td class="px-3 py-2 text-sm text-center">${data.contratistasUnicos.size}</td>
                    <td class="px-3 py-2 text-sm text-center">${data.countContratos}</td>
                    <td class="px-3 py-2 text-sm text-right font-bold">${formatCurrency(data.totalValue)}</td>
                `;
             });
        } else { tablaResumenDependenciaBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">No hay datos de áreas/delegaturas para contratistas frecuentes.</td></tr>`; }
        generarGraficoTopContratistas(_multiContratistasArrayGlobalData.slice(0, 5));
        generarGraficoDependencias(_dependenciasArrayGlobalData); 
    }
    
    function generarGraficoTopContratistas(dataParaElGrafico) {
        const canvasEl = document.getElementById('chartTopContratistas');
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        if (chartTopContratistas) chartTopContratistas.destroy();
        if (!dataParaElGrafico || dataParaElGrafico.length === 0) { canvasEl.parentElement.style.display = 'none'; return; }
        canvasEl.parentElement.style.display = 'block';
        chartTopContratistas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dataParaElGrafico.map(d => `${d.nombreDisplay.substring(0,20)}...(${d.documentoSecop.substring(0,6)})`),
                datasets: [{ 
                    label: 'Valor Total Contratado', 
                    data: dataParaElGrafico.map(d => d.totalValue), 
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                indexAxis: 'y', 
                scales: { 
                    x: { 
                        beginAtZero: true, 
                        ticks: { callback: value => formatCurrency(value) },
                        grid: { color: 'rgba(229, 231, 235, 0.8)' }
                    }, 
                    y: { 
                        ticks: { autoSkip: false, font: { size: 10 } },
                        grid: { display: false }
                    } 
                }, 
                plugins: { 
                    tooltip: { 
                        callbacks: { 
                            label: context => `${context.dataset.label}: ${formatCurrency(context.raw)}` 
                        } 
                    },
                    legend: { display: false }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const clickedData = dataParaElGrafico[index]; 
                        if (clickedData && clickedData.documentoSecop) {
                            aplicarFiltroGlobal('contratista', clickedData.documentoSecop, `${clickedData.nombreDisplay} (${clickedData.documentoSecop})`);
                        }
                    }
                }
            }
        });
    }
    
    function generarGraficoDependencias(dataParaLosGraficos) {
        const canvasValorEl = document.getElementById('chartValorPorDependencia');
        const canvasCantidadEl = document.getElementById('chartCantidadPorDependencia');
        if(!canvasValorEl || !canvasCantidadEl) return;
        const ctxValor = canvasValorEl.getContext('2d');
        const ctxCantidad = canvasCantidadEl.getContext('2d');
        if (chartValorPorDependencia) chartValorPorDependencia.destroy();
        if (chartCantidadPorDependencia) chartCantidadPorDependencia.destroy();
        if (!dataParaLosGraficos || dataParaLosGraficos.length === 0) { 
            canvasValorEl.parentElement.style.display = 'none'; 
            canvasCantidadEl.parentElement.style.display = 'none'; 
            return;
        }
        canvasValorEl.parentElement.style.display = 'block';
        canvasCantidadEl.parentElement.style.display = 'block';
        const topDataParaGraficos = dataParaLosGraficos.slice(0, 7); 
        const labels = topDataParaGraficos.map(d => d.nombre);
        const backgroundColors = [
            'rgba(239, 68, 68, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(245, 158, 11, 0.8)', 
            'rgba(16, 185, 129, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)', 
            'rgba(107, 114, 128, 0.8)'
        ];
        const borderColors = backgroundColors.map(color => color.replace('0.8', '1'));
        
        chartValorPorDependencia = new Chart(ctxValor, { 
            type: 'doughnut', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Valor Total Contratado', 
                    data: topDataParaGraficos.map(d => d.totalValue), 
                    backgroundColor: backgroundColors, 
                    borderColor: borderColors, 
                    borderWidth: 2 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { 
                    tooltip: { 
                        callbacks: { 
                            label: context => `${context.label}: ${formatCurrency(context.raw)}` 
                        } 
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            font: { size: 11 }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const clickedDepData = topDataParaGraficos[index]; 
                         if (clickedDepData && clickedDepData.nombre) {
                            aplicarFiltroGlobal('area', clickedDepData.nombre, `Área: ${clickedDepData.nombre}`);
                        }
                    }
                }
            }
        });
        
        chartCantidadPorDependencia = new Chart(ctxCantidad, { 
            type: 'bar', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    label: 'Contratistas Únicos', 
                    data: topDataParaGraficos.map(d => d.contratistasUnicos.size), 
                    backgroundColor: backgroundColors, 
                    borderColor: borderColors, 
                    borderWidth: 1 
                }] 
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        ticks: { 
                            stepSize: 1, 
                            callback: function(value) {
                                if (Number.isInteger(value)) {return value;}
                            } 
                        },
                        grid: { color: 'rgba(229, 231, 235, 0.8)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }, 
                plugins: { 
                    tooltip: { 
                        callbacks: { 
                            label: context => `${context.label}: ${context.raw} contratistas únicos` 
                        } 
                    },
                    legend: { display: false }
                },
                onClick: (event, elements) => {
                     if (elements.length > 0) {
                        const index = elements[0].index;
                        const clickedDepData = topDataParaGraficos[index];
                         if (clickedDepData && clickedDepData.nombre) {
                            aplicarFiltroGlobal('area', clickedDepData.nombre, `Área: ${clickedDepData.nombre}`);
                        }
                    }
                }
            }
        });
    }

    // --- Funciones de filtros globales ---
    function aplicarFiltroGlobal(tipo, valor, nombre) {
        _filtroGlobalActivo = { tipo, valor, nombre };
        
        let contratosFiltrados = [];
        let multiContratistasFiltrados = [];
        
        if (tipo === 'contratista') {
            contratosFiltrados = _contratosValidosGlobal.filter(c => c.documentoSecop === valor);
            multiContratistasFiltrados = _multiContratistasArrayGlobalData.filter(mc => mc.documentoSecop === valor);
        } else if (tipo === 'area') {
            contratosFiltrados = _contratosValidosGlobal.filter(c => 
                c.dependencia === valor && _docSecopContratistasFrecuentesGlobal.has(c.documentoSecop)
            );
            multiContratistasFiltrados = _multiContratistasArrayGlobalData.filter(contractorData => {
                return _contratosValidosGlobal.some(c => 
                    c.documentoSecop === contractorData.documentoSecop && c.dependencia === valor
                );
            });
        }
        
        // Actualizar todas las tablas con datos filtrados
        populateContractsTable(tablaTodosContratosBody, contratosFiltrados);
        populateMultiContractorTable(multiContratistasFiltrados);
        
        // Mostrar indicador de filtro activo
        mostrarIndicadorFiltroActivo(nombre);
        
        // Asegurar que las tablas estén visibles
        if(contenedorTablaValidos) contenedorTablaValidos.classList.remove('hidden');
        if(toggleTablaValidos) toggleTablaValidos.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
        if(contenedorTablaMultiContratistas) contenedorTablaMultiContratistas.classList.remove('hidden');
        if(toggleTablaMultiContratistas) toggleTablaMultiContratistas.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
    }
    
    function limpiarFiltroGlobal() {
        _filtroGlobalActivo = null;
        
        // Restaurar todas las tablas con datos completos
        populateContractsTable(tablaTodosContratosBody, _contratosValidosGlobal);
        if(tituloMultiContratistasEl) tituloMultiContratistasEl.dataset.isFiltered = "false";
        populateMultiContractorTable(_multiContratistasArrayGlobalData);
        
        // Ocultar indicador de filtro
        ocultarIndicadorFiltroActivo();
    }
    
    function mostrarIndicadorFiltroActivo(nombreFiltro) {
        let indicadorEl = document.getElementById('indicador-filtro-global');
        if (!indicadorEl) {
            indicadorEl = document.createElement('div');
            indicadorEl.id = 'indicador-filtro-global';
            indicadorEl.className = 'bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-3 mb-4 rounded flex justify-between items-center';
            
            const messageBoxParent = messageBox ? messageBox.parentElement : document.querySelector('.container');
            if (messageBoxParent) {
                messageBoxParent.insertBefore(indicadorEl, messageBoxParent.firstChild.nextSibling);
            }
        }
        
        indicadorEl.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-filter mr-2"></i>
                <span>Filtro activo: <strong>${nombreFiltro}</strong></span>
            </div>
            <button onclick="limpiarFiltroGlobal()" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                <i class="fas fa-times mr-1"></i>Limpiar Filtro
            </button>
        `;
        indicadorEl.style.display = 'flex';
        
        // Hacer la función accesible globalmente
        window.limpiarFiltroGlobal = limpiarFiltroGlobal;
    }
    
    function ocultarIndicadorFiltroActivo() {
        const indicadorEl = document.getElementById('indicador-filtro-global');
        if (indicadorEl) {
            indicadorEl.style.display = 'none';
        }
    }

    // --- Event Listeners & Initialization ---
    if(toggleTablaValidos) toggleTablaValidos.addEventListener('click', function() {
        const isHidden = contenedorTablaValidos.classList.toggle('hidden');
        this.textContent = isHidden ? 'Mostrar Detalles' : 'Ocultar Detalles';
        this.innerHTML = isHidden ? '<i class="fas fa-eye"></i> Mostrar Detalles' : '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
    });
    
    if(toggleTablaRechazados) toggleTablaRechazados.addEventListener('click', function() {
        const isHidden = contenedorTablaRechazados.classList.toggle('hidden');
        this.innerHTML = isHidden ? '<i class="fas fa-eye"></i> Mostrar Detalles' : '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
    });
    
    if(toggleTablaMultiContratistas) toggleTablaMultiContratistas.addEventListener('click', function() {
        const isHidden = contenedorTablaMultiContratistas.classList.toggle('hidden');
        this.innerHTML = isHidden ? '<i class="fas fa-eye"></i> Mostrar Detalles' : '<i class="fas fa-eye-slash"></i> Ocultar Detalles';
    });
    
    if(toggleTablaDrilldown) toggleTablaDrilldown.addEventListener('click', function() {
        if(contenedorTablaDrilldown) contenedorTablaDrilldown.classList.add('hidden');
        if(drilldownSectionEl) drilldownSectionEl.classList.add('hidden'); 
    });
    
    if(tablaMultiContratistasBody) tablaMultiContratistasBody.addEventListener('click', function(event) {
        let targetRow = event.target.closest('tr');
        if (targetRow && targetRow.parentElement === tablaMultiContratistasBody) {
            const docSecop = targetRow.getAttribute('data-doc-secop');
            const nombreDisplay = targetRow.getAttribute('data-nombre-display');
            if (docSecop) {
                const filtered = _contratosValidosGlobal.filter(c => c.documentoSecop === docSecop);
                displayDrilldownTable(filtered, `Contratos para Doc.SECOP: ${docSecop} (${nombreDisplay})`);
            }
        }
    });
    
    if(tablaResumenDependenciaBody) tablaResumenDependenciaBody.addEventListener('click', function(event) {
        let targetRow = event.target.closest('tr');
        if (targetRow && targetRow.parentElement === tablaResumenDependenciaBody) {
            const areaNombre = targetRow.getAttribute('data-area-nombre');
            if (areaNombre) {
                filterAndDisplayMultiContractorsByArea(areaNombre);
                const seccionMulti = document.getElementById('seccion-multi-contratistas');
                if (seccionMulti) seccionMulti.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    async function cargarYProcesarCSVDesdeServidor(nombreArchivo = 'Libro8.csv') {
        showMessage(`Cargando datos desde '${nombreArchivo}'...`, 'info');
        console.log(`DEVLOG: Intentando cargar ${nombreArchivo} desde el servidor/repositorio.`);
        try {
            const response = await fetch(nombreArchivo); 
            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}: ${response.statusText}. No se pudo cargar '${nombreArchivo}'. Asegúrate de que el archivo exista en la ruta correcta en tu Replit (raíz del proyecto o ajusta la ruta en el script).`);
            }
            const csvText = await response.text();
            if (!csvText || csvText.trim() === '') {
                throw new Error(`El archivo CSV '${nombreArchivo}' está vacío o no se pudo leer correctamente.`);
            }

            console.log(`DEVLOG: Archivo '${nombreArchivo}' cargado exitosamente. Longitud: ${csvText.length}`);
            const data = parseCSV(csvText);
            procesarDatos(data);

        } catch (error) {
            console.error("Error crítico al cargar o procesar CSV desde el servidor/repositorio:", error);
            showMessage(`Error al cargar datos: ${error.message}. Revisa la consola.`, 'error');
            if(analysisSectionsEl) analysisSectionsEl.classList.add('hidden');
            if(drilldownSectionEl) drilldownSectionEl.classList.add('hidden');
            actualizarResumenesGlobales([], [], 0, 0, 0);
        }
    }

    function inicializarPagina() {
        const fechaGeneracionEl = document.getElementById('fecha-generacion');
        const currentYearEl = document.getElementById('current-year');
        if(fechaGeneracionEl) fechaGeneracionEl.textContent = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        if(currentYearEl) currentYearEl.textContent = new Date().getFullYear();

        if(analysisSectionsEl) analysisSectionsEl.classList.add('hidden'); 
        if(seccionContratosRechazados) seccionContratosRechazados.style.display = 'none';
        if(drilldownSectionEl) drilldownSectionEl.classList.add('hidden'); 

        if(toggleTablaValidos) {
            toggleTablaValidos.innerHTML = '<i class="fas fa-eye"></i> Mostrar Detalles';
            contenedorTablaValidos.classList.add('hidden');
        }
        if(toggleTablaRechazados) {
            toggleTablaRechazados.innerHTML = '<i class="fas fa-eye"></i> Mostrar Detalles';
            contenedorTablaRechazados.classList.add('hidden');
        }
        if(toggleTablaMultiContratistas) {
            toggleTablaMultiContratistas.innerHTML = '<i class="fas fa-eye"></i> Mostrar Detalles';
            contenedorTablaMultiContratistas.classList.add('hidden');
        }
        if(toggleTablaDrilldown) {
            toggleTablaDrilldown.innerHTML = '<i class="fas fa-times"></i> Cerrar Detalle';
            contenedorTablaDrilldown.classList.add('hidden');
        }
        if(tituloMultiContratistasEl) {
            tituloMultiContratistasEl.dataset.originalTitle = "Contratistas con Múltiples Contratos (por Doc. SECOP, Basado en Contratos Válidos)";
            tituloMultiContratistasEl.dataset.isFiltered = "false";
         }
        console.log("Página de análisis de contratistas inicializada. Intentando cargar datos desde el servidor...");

        cargarYProcesarCSVDesdeServidor('Libro8.csv'); // Carga automática
    }
    
    inicializarPagina();
});
