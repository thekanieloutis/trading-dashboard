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
    const GEMINI_API_KEY = "Tgen-lang-client-0858900635";

async function runAICoach(data) {
    const verdictDiv = document.getElementById('ai-verdict');
    const lastTrade = data[data.length - 1];
    
    // Preparamos el contexto para la IA basado en tu perfil
    const systemPrompt = `Eres un coach de trading experto en psicología (Mark Douglas). 
    Analiza este trade: ${JSON.stringify(lastTrade)}. 
    Ten en cuenta: El usuario trabaja 12h al día, valora la disciplina 1-10 más que el dinero 
    y busca gatillos de SMT y Liquidez. 
    Si la psicología es < 5, sé firme. Si es > 8, felicítalo aunque pierda dinero.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });
        
        const result = await response.json();
        const aiText = result.candidates[0].content.parts[0].text;
        
        verdictDiv.innerHTML = `<div class="bg-sky-900/20 p-3 rounded-lg border border-sky-500/30 text-sky-200">
            ${aiText}
        </div>`;
    } catch (e) {
        verdictDiv.innerHTML = "El Coach está descansando. Revisa tu API Key.";
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
