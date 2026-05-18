const APPS_SCRIPT_URL = CONFIG.APPS_SCRIPT_URL;
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;

let tradesDatabase = [];
let chartInstance;

window.onload = syncFromSheets;

async function syncFromSheets() {
    const verdict = document.getElementById('ai-verdict');
    verdict.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-sky-500 mr-2"></i> Conectando con tus Métricas Funded...';
    
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const data = await response.json();
        
        // Filtrar filas vacías para evitar errores de renderizado
        tradesDatabase = data.filter(t => t["Resultado ($)"] !== undefined || t["Resultado"] !== undefined);
        
        renderBento(tradesDatabase);
        runGlobalCoach(tradesDatabase);
    } catch (e) {
        console.error(e);
        verdict.innerHTML = '<span class="text-rose-400">❌ Error de conexión. Verifica la configuración de tu Apps Script.</span>';
    }
}

function renderBento(data) {
    const tbody = document.getElementById('trade-table-body');
    tbody.innerHTML = '';
    
    let totalPl = 0;
    let psychSum = 0;
    let wins = 0;
    let grossProfits = 0;
    let grossLosses = 0;
    let equityPoints = [];

    data.forEach((trade, index) => {
        // 1. LIMPIAR EL FORMATO DE LA FECHA (Quita el T22:00:00.000Z)
        let fechaLimpia = trade.Fecha || 'N/A';
        if (typeof fechaLimpia === 'string' && fechaLimpia.includes('T')) {
            fechaLimpia = fechaLimpia.split('T')[0];
        }

        // 2. ASIGNACIÓN SEGURA DE VARIABLES (Con alternativas por si cambia el nombre en tu Excel)
        const pl = parseFloat(trade["Resultado ($)"] || trade["Resultado"] || 0);
        const psych = parseInt(trade["Psicología (1-10)"] || trade["Psicología"] || 0);
        const mfe = trade["MFE (Pts)"] || trade["MFE"] || "-";
        const instrumento = trade["Instrumento"] || "N/A";
        const gatillo = trade["Gatillo"] || "N/A";
        const macro = trade["Macro"] || "Macro no definida";

        totalPl += pl;
        psychSum += psych;
        
        if (pl > 0) {
            wins++;
            grossProfits += pl;
        } else {
            grossLosses += Math.abs(pl);
        }
        
        equityPoints.push(totalPl);

        const plString = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`;
        const plClass = pl >= 0 ? 'text-emerald-400' : 'text-rose-500';

        // 3. INYECCIÓN DE LAS 6 COLUMNAS BIEN ALINEADAS
        tbody.innerHTML += `
            <tr onclick="inspectTrade(${index})" class="hover:bg-slate-800/40 cursor-pointer transition border-b border-slate-800/50">
                <td class="p-4 font-semibold text-white">
                    ${fechaLimpia}<br>
                    <span class="text-[10px] text-sky-500 font-normal">${macro}</span>
                </td>
                <td class="p-4 text-slate-400 font-medium">
                    ${instrumento}
                </td>
                <td class="p-4">
                    <span class="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded">
                        ${gatillo}
                    </span>
                </td>
                <td class="p-4 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${psych >= 8 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                        ${psych}/10
                    </span>
                </td>
                <td class="p-4 text-right font-mono text-slate-400">
                    ${mfe}
                </td>
                <td class="p-4 text-right font-bold ${plClass}">
                    ${plString}
                </td>
            </tr>
        `;
    });

    // Actualizar Tarjetas KPI de los bloques Bento superiores
    document.getElementById('stat-pl').innerText = totalPl >= 0 ? `+$${totalPl.toFixed(2)}` : `-$${Math.abs(totalPl).toFixed(2)}`;
    document.getElementById('stat-pl').className = `text-4xl font-black my-4 ${totalPl >= 0 ? 'text-emerald-400' : 'text-rose-500'}`;
    document.getElementById('stat-wr').innerText = data.length > 0 ? `${((wins / data.length) * 100).toFixed(1)}%` : '0%';
    
    const avgPsych = data.length > 0 ? (psychSum / data.length).toFixed(1) : '0.0';
    document.getElementById('stat-psych').innerHTML = `${avgPsych}<span class="text-lg text-slate-600">/10</span>`;
    
    const pf = grossLosses > 0 ? (grossProfits / grossLosses).toFixed(2) : totalPl > 0 ? totalPl.toFixed(2) : "0.00";
    document.getElementById('stat-pf').innerText = pf;

    renderChart(equityPoints);
}

function filterTrades(type) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('bg-sky-600', 'text-white'));
    event.target.classList.add('bg-sky-600', 'text-white');
    
    if (type === 'all') renderBento(tradesDatabase);
    if (type === 'psych') renderBento(tradesDatabase.filter(t => parseInt(t["Psicología (1-10)"] || t["Psicología"]) >= 8));
}

function inspectTrade(index) {
    const trade = tradesDatabase[index];
    const verdict = document.getElementById('ai-verdict');
    const notes = trade.Observaciones || trade["Vaciado Mental"] || "Sin anotaciones en tu vaciado mental para esta sesión.";
    
    verdict.innerHTML = `
        <div class="space-y-2">
            <div class="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Análisis del Trade Especializado:</div>
            <p class="text-white font-semibold">Gatillo: ${trade.Gatillo || 'N/A'} en ${trade.Instrumento || 'N/A'}</p>
            <p class="text-slate-400 mt-1">"${notes}"</p>
            <div class="pt-2 text-[10px] text-slate-500 border-t border-slate-800">Psicología registrada: ${trade["Psicología (1-10)"] || trade["Psicología"]}/10 | Recorrido MFE: ${trade["MFE (Pts)"] || trade["MFE"]}</div>
        </div>
    `;
}

function runGlobalCoach(data) {
    const header = document.getElementById('main-header');
    const warning = document.getElementById('warning-pill');
    const lastThree = data.slice(-3);
    const lowPsych = lastThree.filter(t => parseInt(t["Psicología (1-10)"] || t["Psicología"]) < 5).length;

    if (lowPsych >= 2) {
        header.classList.add('pulse-danger');
        warning.classList.remove('hidden');
        warning.innerText = "⚠️ ALERTA: SECUENCIA DE BAJA DISCIPLINA DETECTADA. REVISA TU FATIGA.";
    } else {
        header.classList.remove('pulse-danger');
        warning.classList.add('hidden');
    }
}

function renderChart(points) {
    const ctx = document.getElementById('equityChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    let gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(14, 165, 233, 0.3)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map((_, i) => `T ${i + 1}`),
            datasets: [{
                data: points,
                borderColor: '#0ea5e9',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { grid: { color: '#1e293b' } }, x: { grid: { display: false } } }
        }
    });
}
