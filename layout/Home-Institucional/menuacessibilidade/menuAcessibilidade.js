


// <!-- SCRIPT VERSAO DESKTOP -->




    let menuToggle = document.querySelector('.toggle');
    let menu = document.querySelector('.center');
    document.getElementById("myBtn").addEventListener("click", function () {

        menuToggle.classList.toggle('active');
        menu.classList.toggle('active');

        let icone = document.querySelector('.teste');

        if (menuToggle.classList.contains("active")) { //se tem olho aberto

            icone.classList.remove("bi-universal-access-circle"); //remove classe olho aberto
            icone.classList.add("bi-x-circle-fill"); //coloca classe olho fechado

        } else { //senão

            icone.classList.remove("bi-x-circle-fill"); //remove classe olho fechado
            icone.classList.add("bi-universal-access-circle"); //coloca classe olho aberto

        }

    });




    // <!-- SCRIPT VERSAO MOBILE -->

    var meuElemento = document.getElementById('draggable');
    var posicaoInicial = null;
    var posicaoTopInicial = null;

    meuElemento.addEventListener('touchstart', function (event) {
        document.body.style.overflow = 'hidden';
        posicaoInicial = event.touches[0].clientY;
        posicaoTopInicial = parseInt(meuElemento.style.top) || 450;
    });

    meuElemento.addEventListener('touchmove', function (event) {
        if (posicaoInicial === null) {
            return;
        }

        var posicaoAtual = event.touches[0].clientY;
        var diferenca = posicaoAtual - posicaoInicial;
        var novaPosicao = posicaoTopInicial + diferenca;

        meuElemento.style.top = novaPosicao + 'px';
    });

    meuElemento.addEventListener('touchend', function (event) {
        document.body.style.overflow = 'initial';
        posicaoInicial = null;
    });






// seleciona o elemento que será arrastado
const draggable = document.getElementById("draggable");

// variáveis para armazenar a posição inicial do mouse e do elemento
let startY, startTop;

// adiciona um evento de clique ao elemento para iniciar o arraste
draggable.addEventListener("mousedown", function (event) {
    // armazena a posição do mouse e do elemento no início do arraste
    startY = event.clientY;
    startTop = parseInt(window.getComputedStyle(draggable).getPropertyValue("top"));

    // adiciona um evento de movimento do mouse para atualizar a posição do elemento
    document.addEventListener("mousemove", dragElement);
});

// adiciona um evento de soltura do mouse para finalizar o arraste
document.addEventListener("mouseup", function () {
    // remove o evento de movimento do mouse para parar de atualizar a posição do elemento
    document.removeEventListener("mousemove", dragElement);
});

// função para atualizar a posição do elemento durante o arraste
function dragElement(event) {
    // calcula a diferença entre a posição do mouse no momento e a posição inicial do mouse
    const diffY = event.clientY - startY;

    // atualiza a posição vertical do elemento com base na diferença calculada
    draggable.style.top = startTop + diffY + "px";
}

