const APPS_SCRIPT_URL = CONFIG.APPS_SCRIPT_URL;
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;

let globalData = [];
let equityChart;

// Iniciar aplicación
window.onload = syncData;

async function syncData() {
    const verdict = document.getElementById('ai-verdict');
    verdict.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando notas mentales y métricas de MFE...';
    
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const data = await response.json();
        
        if(data.error) throw new Error(data.error);

        globalData = data.filter(t => t["Resultado ($)"] !== undefined && t["Resultado ($)"] !== ""); 
        
        processAndRender(globalData);
        runAICoach(globalData);
        
    } catch (e) {
        console.error("Error conectando a Sheets:", e);
        verdict.innerHTML = `<span class="text-tz-red"><i class="fa-solid fa-circle-xmark"></i> Error de conexión. Revisa el enlace de Apps Script.</span>`;
    }
}

// Botones de Filtrado Interactivo
function filterData(type) {
    // Actualizar estilos de botones
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-slate-700', 'text-white');
        btn.classList.add('text-slate-400', 'hover:bg-slate-800');
    });
    event.target.classList.add('bg-slate-700', 'text-white');
    event.target.classList.remove('text-slate-400', 'hover:bg-slate-800');

    // Lógica de filtrado
    let filtered = [];
    if (type === 'all') filtered = globalData;
    if (type === 'win') filtered = globalData.filter(t => parseFloat(t["Resultado ($)"]) > 0);
    if (type === 'loss') filtered = globalData.filter(t => parseFloat(t["Resultado ($)"]) <= 0);
    if (type === 'psych') filtered = globalData.filter(t => parseInt(t["Psicología (1-10)"]) >= 8);

    processAndRender(filtered);
}

function processAndRender(dataToRender) {
    const tbody = document.getElementById('trade-table-body');
    tbody.innerHTML = '';
    
    let totalPl = 0;
    let psychAcc = 0;
    let wins = 0;
    let equityPoints = [];

    dataToRender.forEach(trade => {
        const pl = parseFloat(trade["Resultado ($)"]) || 0;
        const psych = parseInt(trade["Psicología (1-10)"]) || 0;
        const mfe = trade["MFE (Pts)"] || "-";
        
        totalPl += pl;
        psychAcc += psych;
        if (pl > 0) wins++;
        
        equityPoints.push(totalPl);

        // Formateo de moneda
        const plString = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`;
        const plClass = pl >= 0 ? 'text-tz-green' : 'text-tz-red';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-800/30 transition-colors group">
                <td class="py-4 px-6 border-b border-tz-border text-slate-300">
                    <div class="font-semibold">${trade.Fecha || 'N/A'}</div>
                    <div class="text-xs text-tz-blue opacity-70 group-hover:opacity-100 transition">${trade.Macro || 'Macro no definida'}</div>
                </td>
                <td class="py-4 px-6 border-b border-tz-border">
                    <span class="pill neutral"><i class="fa-solid fa-crosshairs mr-1"></i> ${trade.Gatillo || 'N/A'}</span>
                </td>
                <td class="py-4 px-6 border-b border-tz-border text-center">
                    <span class="pill ${psych >= 8 ? 'green' : (psych <= 4 ? 'red' : 'neutral')}">
                        ${psych}/10
                    </span>
                </td>
                <td class="py-4 px-6 border-b border-tz-border text-slate-400 font-mono text-sm">
                    ${mfe} pts
                </td>
                <td class="py-4 px-6 border-b border-tz-border text-right font-bold ${plClass}">
                    ${plString}
                </td>
            </tr>
        `;
    });

    // Actualizar KPIs de la UI
    document.getElementById('stat-pl').innerText = totalPl >= 0 ? `+$${totalPl.toFixed(2)}` : `-$${Math.abs(totalPl).toFixed(2)}`;
    document.getElementById('stat-pl').className = `text-3xl font-black mt-1 ${totalPl >= 0 ? 'text-white' : 'text-tz-red'}`;
    
    const winRate = dataToRender.length > 0 ? ((wins / dataToRender.length) * 100).toFixed(1) : 0;
    document.getElementById('stat-wr').innerText = `${winRate}%`;
    
    const avgPsych = dataToRender.length > 0 ? (psychAcc / dataToRender.length).toFixed(1) : 0;
    document.getElementById('stat-psych').innerHTML = `${avgPsych}<span class="text-lg text-slate-500">/10</span>`;

    updateChart(equityPoints);
}

function updateChart(points) {
    const ctx = document.getElementById('equityChart').getContext('2d');
    
    if (equityChart) equityChart.destroy();

    // Crear un gradiente debajo de la línea
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // tz-blue
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map((_, i) => `Trade ${i + 1}`),
            datasets: [{
                label: 'Net P&L',
                data: points,
                borderColor: '#3b82f6',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4, // Curvas suaves
                pointBackgroundColor: '#0a0e17',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111827',
                    titleColor: '#94a3b8',
                    bodyColor: '#fff',
                    borderColor: '#1f2937',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                y: { grid: { color: '#1f2937', drawBorder: false }, ticks: { color: '#64748b' } },
                x: { display: false }
            }
        }
    });
}

function runAICoach(data) {
    if(data.length === 0) return;
    
    const lastThree = data.slice(-3);
    const lowPsychCount = lastThree.filter(t => parseInt(t["Psicología (1-10)"]) < 5).length;
    
    const verdict = document.getElementById('ai-verdict');
    const warning = document.getElementById('warning-msg');
    const header = document.getElementById('main-header');

    if (lowPsychCount >= 2) {
        // Alerta de Zombie Mode activada
        header.classList.add('animate-bg-danger');
        warning.classList.remove('hidden');
        verdict.innerHTML = `<span class="text-tz-red font-bold">Modo Venganza / Fatiga Detectado.</span> Tus últimas operaciones muestran niveles de disciplina muy bajos. Aléjate de los gráficos y revisa si es por tu turno de 12 horas.`;
    } else {
        header.classList.remove('animate-bg-danger');
        warning.classList.add('hidden');
        const last = data[data.length-1];
        if (parseInt(last["Psicología (1-10)"]) >= 8) {
            verdict.innerHTML = `<span class="text-tz-green font-bold">¡Excelente Disciplina!</span> Tu última operación tuvo un ${last["Psicología (1-10)"]}/10. Respetaste el proceso. Este es el camino para fondear tu cuenta, el resultado monetario hoy es secundario.`;
        } else {
            verdict.innerHTML = `Tu última sesión fue estándar. Mantén el foco en la paciencia y espera la toma de liquidez en las macros.`;
        }
    }
}
