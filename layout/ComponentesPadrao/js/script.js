
var colors = ["#66ccff", "#110000", "#c16100", "#be6700"];
var svgNS = "http://www.w3.org/2000/svg";
var bubblesFooter = document.getElementById("bubbles-footer");
var maxBubbles = 100; // Número máximo de bolhas

// Função para criar bolhas
function createBubbles() {
    for (let i = 0; i < maxBubbles; i++) {
        var radius = Math.random() * 20 + 5; // Raio aleatório entre 5 e 25
        var circle = document.createElementNS(svgNS, "circle");
        circle.setAttributeNS(null, "r", radius);
        circle.setAttribute("fill", "none");
        circle.setAttribute("stroke", "#000");

        // Muda a cor ao passar o mouse
        circle.addEventListener("mouseover", function() {
            var randomColor = colors[Math.floor(Math.random() * colors.length)];
            this.setAttribute("fill", randomColor);
        });

        positionCircle(circle);
        bubblesFooter.appendChild(circle);
    }
}

// Função para posicionar as bolhas aleatoriamente
function positionCircle(circle) {
    var x = Math.random() * 1920; // Largura do SVG
    var y = Math.random() * 100;   // Altura do SVG
    circle.setAttributeNS(null, "cx", x);
    circle.setAttributeNS(null, "cy", y);
}

// Cria as bolhas ao carregar a página
createBubbles();

// Atualiza a posição das bolhas ao redimensionar a janela
window.addEventListener("resize", function() {
    // Reposiciona as bolhas se necessário
    Array.from(bubblesFooter.children).forEach(positionCircle);
});





































// var colors = ["#66ccff", "#110000", "#c16100", "#be6700"];
// var screenWidth = window.innerWidth;
// var screenHeight = window.innerHeight;
// var svgNS = "http://www.w3.org/2000/svg";
// var bubblesFooter = document.getElementById("bubbles-footer");
// var footerCircles = [];
// var maxFooterCircles = 300; // Limite máximo de bolhas

// // Função para construir bolhas no rodapé de forma assíncrona
// async function buildFooterCircles(totalCircles) {
//     for (let e = 0; e < totalCircles; e++) {
//         if (footerCircles.length < maxFooterCircles) {
//             await createFooterCircle(); // Espera a criação da bolha
//         }
//     }
// }

// // Função para criar uma bolha no rodapé
// function createFooterCircle() {
//     return new Promise((resolve) => {
//         var radius = getRandom(4, 26);
//         var circle = document.createElementNS(svgNS, "circle");
//         circle.setAttributeNS(null, "r", radius);
//         circle.setAttribute("fill", "none");
//         circle.setAttribute("stroke", "#000");

//         // Evento ao passar o mouse
//         circle.addEventListener("mouseover", function() {
//             var randomColor = colors[getRandom(0, colors.length - 1)];
//             this.setAttribute("fill", randomColor);
//         });

//         positionFooterCircle(circle);
//         bubblesFooter.appendChild(circle);
//         footerCircles.push(circle); // Adiciona à lista de bolhas
//         resolve(); // Resolve a promessa após a bolha ser criada
//     });
// }

// // Função para posicionar bolhas no rodapé
// function positionFooterCircle(circle) {
//     var x = getRandom(1, screenWidth);
//     var y = getRandom(28, 300);
//     circle.setAttributeNS(null, "cx", x);
//     circle.setAttributeNS(null, "cy", y);
// }

// // Função para obter um número aleatório entre dois valores
// function getRandom(min, max) {
//     return min + Math.floor(Math.random() * (max - min + 1));
// }

// // Inicialização das bolhas do rodapé
// var totalFooterCircles = 300;
// buildFooterCircles(totalFooterCircles);

// // Adicionando evento de resize para ajustar as bolhas
// window.addEventListener("resize", function() {
//     screenWidth = window.innerWidth;
//     screenHeight = window.innerHeight;
//     rearrangeFooterCircles();
// });

// // Função para reposicionar bolhas no rodapé
// function rearrangeFooterCircles() {
//     footerCircles.forEach(positionFooterCircle);
// }