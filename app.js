const APPS_SCRIPT_URL = CONFIG.APPS_SCRIPT_URL;
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;

let equityChart;

async function syncData() {
    const verdict = document.getElementById('ai-verdict');
    verdict.innerHTML = "Sincronizando con Google Sheets...";

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const data = await response.json();
        renderDashboard(data);
        getAICoachAnalysis(data);
    } catch (e) {
        verdict.innerHTML = "Error de conexión con la API de Google.";
    }
}

function renderDashboard(data) {
    const tbody = document.getElementById('trade-table-body');
    tbody.innerHTML = '';
    let totalPl = 0;
    let psychSum = 0;
    let equityPoints = [];
    let wins = 0;

    data.forEach(trade => {
        const pl = parseFloat(trade["Resultado ($)"]) || 0;
        const psych = parseInt(trade["Psicología (1-10)"]) || 0;
        totalPl += pl;
        psychSum += psych;
        if (pl > 0) wins++;
        equityPoints.push(totalPl);

        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition">
                <td class="p-4 text-slate-400 font-mono text-xs">${trade.Fecha}<br><span class="text-sky-500">${trade.Macro || 'Sin Macro'}</span></td>
                <td class="p-4 text-slate-300 font-semibold">${trade.Instrumento || 'NQ'}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${psych >= 8 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}">
                        ${psych}/10
                    </span>
                </td>
                <td class="p-4 text-slate-400 text-xs">${trade.Gatillo || 'Toma de Liq.'}</td>
                <td class="p-4 text-right text-slate-500">${trade.MFE || '0%'}</td>
                <td class="p-4 text-right font-bold ${pl >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
                    ${pl >= 0 ? '+' : ''}${pl.toFixed(2)}
                </td>
            </tr>
        `;
    });

    // Actualizar KPIs
    document.getElementById('stat-pl').innerText = `$${totalPl.toFixed(2)}`;
    document.getElementById('stat-wr').innerText = `${((wins/data.length)*100).toFixed(1)}%`;
    document.getElementById('stat-psych').innerText = (psychSum/data.length).toFixed(1);
    
    updateChart(equityPoints);
}

async function getAICoachAnalysis(data) {
    const verdict = document.getElementById('ai-verdict');
    const coachCard = document.getElementById('coach-card');
    const alertBox = document.getElementById('coach-alert');
    
    const lastTrades = data.slice(-5); // Analiza los últimos 5 trades
    
    // Alerta de Disciplina
    const lowPsych = lastTrades.filter(t => parseInt(t["Psicología (1-10)"]) < 5).length;
    if (lowPsych >= 3) {
        coachCard.classList.add('alert-glow');
        alertBox.classList.remove('hidden');
    } else {
        coachCard.classList.remove('alert-glow');
        alertBox.classList.add('hidden');
    }

    // Llamada a la IA para Juicio Concreto
    const lastSession = lastTrades[lastTrades.length - 1];
    const prompt = `Actúa como Coach de Trading (Mark Douglas). Analiza este registro: 
    P&L: ${lastSession["Resultado ($)"]}, Psicología: ${lastSession["Psicología (1-10)"]}, Notas: ${lastSession.Observaciones}. 
    El usuario trabaja 12h diarias y valora la disciplina 1-10. Dale un veredicto corto y directo sobre su comportamiento.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const resJson = await response.json();
        verdict.innerHTML = `"${resJson.candidates[0].content.parts[0].text}"`;
    } catch (e) {
        verdict.innerHTML = "El Coach detectó un error técnico, pero recuerda: El éxito es tu disciplina.";
    }
}

function updateChart(points) {
    if (equityChart) equityChart.destroy();
    const ctx = document.getElementById('equityChart').getContext('2d');
    equityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map((_, i) => i + 1),
            datasets: [{
                data: points,
                borderColor: '#0ea5e9',
                borderWidth: 2,
                pointRadius: 0,
                backgroundColor: 'rgba(14, 165, 233, 0.05)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#64748b', font: { size: 10 } } }
            }
        }
    });
}
