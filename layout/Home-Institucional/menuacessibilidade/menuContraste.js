

 //código para alterar contraste


var contrasteAtivo = false; // Define se o modo de contraste está ativo ou não

function ativarContraste() {
    var elementos = document.getElementsByTagName("*");

    if (contrasteAtivo) {
        // Desativar modo de contraste
        for (var i = 0; i < elementos.length; i++) {
            elementos[i].style.backgroundColor = "";
            elementos[i].style.color = "";
        }
        contrasteAtivo = false;
    } else {
        // Ativar modo de contraste
        for (var i = 0; i < elementos.length; i++) {
            elementos[i].style.backgroundColor = "#000";
            elementos[i].style.color = "#FFF";
        }
        contrasteAtivo = true;
    }
}




