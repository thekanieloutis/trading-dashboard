const APPS_SCRIPT_URL = CONFIG.APPS_SCRIPT_URL;
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;

let tradesDatabase = [];
let chartInstance;

window.onload = syncFromSheets;

async function syncFromSheets() {
    const verdict = document.getElementById('ai-verdict');
    verdict.innerHTML = 'Cargando bitácora...';
    
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        const data = await response.json();
        
        // Filtrado inteligente para ignorar filas complementarias vacías
        tradesDatabase = data.filter(t => t && (t["Resultado ($)"] !== undefined || t["Resultado"] !== undefined || t["Fecha"] !== undefined));
        
        renderTradyncDashboard(tradesDatabase);
    } catch (e) {
        console.error(e);
        verdict.innerHTML = '<span class="text-rose-400">Error de enlace API.</span>';
    }
}

function renderTradyncDashboard(data) {
    const tbody = document.getElementById('trade-table-body');
    tbody.innerHTML = '';
    
    let totalPl = 0, psychSum = 0, wins = 0;
    let macro1200Count = 0, macro1230Count = 0, otherMacroCount = 0;
    let equityPoints = [];

    data.forEach(trade => {
        // --- MOTOR DETECTOR BLINDADO CONTRA DESFASES ---
        // Busca coincidencias elásticas en los nombres de tus columnas para evitar saltos de celda
        let p&lKey = Object.keys(trade).find(k => k.toLowerCase().includes('resultado') || k.toLowerCase().includes('p&l')) || "";
        let psychKey = Object.keys(trade).find(k => k.toLowerCase().includes('psico')) || "";
        let mfeKey = Object.keys(trade).find(k => k.toLowerCase().includes('mfe')) || "";
        let macroKey = Object.keys(trade).find(k => k.toLowerCase().includes('macro')) || "";
        let instKey = Object.keys(trade).find(k => k.toLowerCase().includes('inst') || k.toLowerCase().includes('simbolo')) || "";
        let gatilloKey = Object.keys(trade).find(k => k.toLowerCase().includes('gatillo')) || "";

        // Extracción segura de valores
        const pl = parseFloat(trade[p&lKey]) || 0;
        const psych = parseInt(trade[psychKey]) || 0;
        const mfe = trade[mfeKey] || "-";
        const macro = trade[macroKey] || "No definida";
        const instrumento = trade[instKey] || trade["Instrumento"] || "N/A";
        const gatillo = trade[gatilloKey] || "N/A";

        // Limpieza estética de fechas ISO
        let fechaLimpia = trade.Fecha || 'N/A';
        if (typeof fechaLimpia === 'string' && fechaLimpia.includes('T')) {
            fechaLimpia = fechaLimpia.split('T')[0];
        }

        // Conteo para el Widget "Por Sesión"
        if (macro.includes('12:00')) macro1200Count++;
        else if (macro.includes('12:30')) macro1230Count++;
        else otherMacroCount++;

        totalPl += pl;
        if (psych > 0) psychSum += psych;
        if (pl > 0) wins++;
        equityPoints.push(totalPl);

        const plClass = pl >= 0 ? 'win-text' : 'loss-text';
        const plString = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`;

        // Inyección milimétrica en la tabla
        tbody.innerHTML += `
            <tr class="hover:bg-[#1f2937]/30 transition border-b border-[#1f2937]/50">
                <td class="p-4 text-white font-medium">${fechaLimpia}<br><span class="text-[10px] text-sky-400">${macro}</span></td>
                <td class="p-4 text-slate-300 font-semibold">${instrumento}</td>
                <td class="p-4"><span class="bg-[#1f2937] text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md">${gatillo}</span></td>
                <td class="p-4 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${psych >= 8 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                        ${psych > 0 ? psych + '/10' : '-'}
                    </span>
                </td>
                <td class="p-4 text-right font-mono text-slate-400">${mfe}</td>
                <td class="p-4 text-right font-black ${plClass}">${plString}</td>
            </tr>
        `;
    });

    // Actualización de Widgets Superiores
    document.getElementById('stat-pl').innerText = totalPl >= 0 ? `+$${totalPl.toFixed(2)}` : `-$${Math.abs(totalPl).toFixed(2)}`;
    document.getElementById('stat-pl').className = `text-2xl font-black mt-2 ${totalPl >= 0 ? 'win-text' : 'loss-text'}`;
    document.getElementById('stat-wr').innerText = data.length > 0 ? `${((wins / data.length) * 100).toFixed(1)}%` : '0.0%';
    
    const validPsychTrades = data.filter(t => parseInt(t["Psicología (1-10)"] || t["Psicología"]) > 0).length;
    const avgPsych = validPsychTrades > 0 ? (psychSum / validPsychTrades).toFixed(1) : '0.0';
    document.getElementById('stat-psych').innerHTML = `${avgPsych}<span class="text-xs text-slate-500">/10</span>`;

    // Sincronizar contadores del Widget Lateral
    document.getElementById('session-1200').innerText = `${macro1200Count} ops`;
    document.getElementById('session-1230').innerText = `${macro1230Count} ops`;
    document.getElementById('session-other').innerText = `${otherMacroCount} ops`;

    // Actualizar diagnóstico rápido del Coach
    const lastTrade = data[data.length - 1];
    if(lastTrade) {
        const notesKey = Object.keys(lastTrade).find(k => k.toLowerCase().includes('observa') || k.toLowerCase().includes('vaciado')) || "";
        document.getElementById('ai-verdict').innerText = lastTrade[notesKey] ? `"${lastTrade[notesKey]}"` : "Sin anotaciones emocionales en la última sesión.";
    }

    renderChart(equityPoints);
}

function renderChart(points) {
    const ctx = document.getElementById('equityChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    let gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.15)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map((_, i) => `Op ${i + 1}`),
            datasets: [{
                data: points,
                borderColor: '#00e676',
                borderWidth: 2.5,
                backgroundColor: gradient,
                fill: true,
                tension: 0.2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#1f2937' }, ticks: { color: '#64748b' } },
                x: { display: false }
            }
        }
    });
}
