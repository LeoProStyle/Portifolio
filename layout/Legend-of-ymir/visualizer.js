const mapasDisponiveis = [
    "mirante-penhasco.json"
];

const selector = document.getElementById("mapSelector");
const filters = document.getElementById("filters");
const mapImage = document.getElementById("mapImage");
const mapContainer = document.getElementById("mapContainer");

let currentMapData = null;
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let lastX, lastY;

// --- Preenche o dropdown ---
function carregarListaMapas() {
    mapasDisponiveis.forEach(m => {
        let opt = document.createElement("option");
        opt.value = m;  // já tem .json
        opt.textContent = m.replace(".json", "");
        selector.appendChild(opt);
    });
}

// --- Carrega JSON do mapa ---
async function carregarMapa(nome) {
    console.log("Carregando mapa:", nome);

    const res = await fetch(`mapas-prontos/${nome}`);
    currentMapData = await res.json();

    // carregar imagem
    mapImage.src = `maps/${currentMapData.mapImage}`;

    gerarFiltros();
    desenharItens();
}

selector.addEventListener("change", () => {
    carregarMapa(selector.value);
});

// --- Cria filtros automáticos ---
function gerarFiltros() {
    filters.innerHTML = "";
    
    // aqui corrige: JSON usa "tipo", não "type"
    const tipos = [...new Set(currentMapData.items.map(i => i.tipo))];

    tipos.forEach(tipo => {
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = true;
        chk.dataset.tipo = tipo;

        chk.addEventListener("change", desenharItens);

        const lbl = document.createElement("label");
        lbl.textContent = tipo;

        const div = document.createElement("div");
        div.appendChild(chk);
        div.appendChild(lbl);

        filters.appendChild(div);
    });
}

// --- Renderizar itens ---
function desenharItens() {
    document.querySelectorAll(".marker").forEach(e => e.remove());

    const ativos = [...document.querySelectorAll("#filters input:checked")]
        .map(c => c.dataset.tipo);

    currentMapData.items
        .filter(i => ativos.includes(i.tipo))
        .forEach(item => {
            const img = document.createElement("img");
            img.className = "marker";
            img.src = `icons/${item.tipo}.png`;

            img.style.left = (item.x * scale + offsetX) + "px";
            img.style.top = (item.y * scale + offsetY) + "px";

            mapContainer.appendChild(img);
        });
}

// --- Zoom ---
mapContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
    scale *= zoom;

    mapImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    desenharItens();
});

// --- Arrastar mapa ---
mapContainer.addEventListener("mousedown", e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
});
mapContainer.addEventListener("mouseup", () => dragging = false);
mapContainer.addEventListener("mouseleave", () => dragging = false);
mapContainer.addEventListener("mousemove", e => {
    if (!dragging) return;

    offsetX += e.clientX - lastX;
    offsetY += e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    mapImage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    desenharItens();
});

// Inicializar
carregarListaMapas();
carregarMapa(mapasDisponiveis[0]);
