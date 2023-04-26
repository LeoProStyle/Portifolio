

var tamanhoDaFonte = 16; // Tamanho padrão da fonte em pixels

function aumentarFonte() {
    tamanhoDaFonte += 2;
    var elementos = document.getElementsByTagName("*");
    for (var i = 0; i < elementos.length; i++) {
        elementos[i].style.fontSize = tamanhoDaFonte + "px";
    }
}

function diminuirFonte() {
    tamanhoDaFonte -= 2;
    var elementos = document.getElementsByTagName("*");
    for (var i = 0; i < elementos.length; i++) {
        elementos[i].style.fontSize = tamanhoDaFonte + "px";
    }
}