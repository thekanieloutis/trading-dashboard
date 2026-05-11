// CONFIGURACIÓN: Pega aquí la URL de tu Apps Script
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwIzl_Hc_TIfNodaThHIRexJz4-Ktv_H-vUyPxhZcF0vbi7gr7IsUM56-7BtGlQ9w/exec";

let equityChart;

async function syncData() {
    try {
        const response = await fetch(APPS_SCRIPT_URL);
        const data = await response.json();
        renderDashboard(data);
        runAICoach(data);
    } catch (e) {
        console.error("Error conectando a Sheets:", e);
    }
}

function renderDashboard(data) {
    const tbody = document.getElementById('trade-table-body');
    tbody.innerHTML = '';
    let totalPl = 0;
    let psychAcc = 0;
    let equityPoints = [];

    data.forEach(trade => {
        const pl = parseFloat(trade["Resultado ($)"]) || 0;
        const psych = parseInt(trade["Psicología (1-10)"]) || 0;
        const mfe = trade["MFE (Pts)"] || "0";
        totalPl += pl;
        psychAcc += psych;
        equityPoints.push(totalPl);

        tbody.innerHTML += `
            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50">
                <td class="p-4 text-slate-400">${trade.Fecha} <br> <span class="text-[10px] text-sky-500">${trade.Macro || ''}</span></td>
                <td class="p-4 font-medium text-slate-300">${trade.Gatillo || 'Sin Gatillo'}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded text-[10px] font-bold ${psych >= 8 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
                        ${psych}/10
                    </span>
                </td>
                <td class="p-4 text-slate-400">${mfe}</td>
                <td class="p-4 text-right font-bold ${pl >= 0 ? 'win' : 'loss'}">${pl >= 0 ? '+$' : '-$'}${Math.abs(pl).toFixed(2)}</td>
            </tr>
        `;
    });

    document.getElementById('stat-pl').innerText = `$${totalPl.toFixed(2)}`;
    document.getElementById('stat-psych').innerText = `${(psychAcc/data.length).toFixed(1)}/10`;
    updateChart(equityPoints);
}

function runAICoach(data) {
    const executed = data.filter(t => t.Accion === "Ejecutada");
    const lastThree = executed.slice(-3);
    const lowPsychCount = lastThree.filter(t => parseInt(t["Psicología (1-10)"]) < 5).length;
    
    const verdict = document.getElementById('ai-verdict');
    const warning = document.getElementById('warning-msg');
    const header = document.getElementById('main-header');

    // Lógica de Alerta de Parpadeo
    if (lowPsychCount >= 3) {
        header.classList.add('animate-alert');
        warning.classList.remove('hidden');
        verdict.innerHTML = "<strong>CRÍTICO:</strong> Has tomado 3 trades con baja disciplina. Tus notas muestran 'corazón acelerado' y fatiga. Orden: Cierra la plataforma.";
    } else {
        header.classList.remove('animate-alert');
        warning.classList.add('hidden');
        const last = data[data.length-1];
        verdict.innerHTML = `Analizando tu última sesión: Veo que respetaste el gatillo ${last.Gatillo}. Tu psicología de ${last["Psicología (1-10)"]} es clave para tu cuenta fondeada.`;
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
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { plugins: { legend: { display: false } }, scales: { x: { display: false } } }
    });
}
