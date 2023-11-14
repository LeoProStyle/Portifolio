// site de origem
// https://www.twilio.com/blog/como-criar-uma-campo-de-numero-de-telefone-internacional-em-html-e-javascript

const listaTelefone = document.querySelector("#telefone");
const entradaTelefone = window.intlTelInput(listaTelefone, {
  utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js",
});



const cookieContainer = document.querySelector(".cookie-container");
const cookieBotao = document.querySelector(".cookie-botao");

cookieBotao.addEventListener("click", () => {
  cookieContainer.classList.remove("active");
  localStorage.setItem("aceitoTermos", "true");
});

setTimeout(() => {
  if (!localStorage.getItem("aceitoTermos")) {
    cookieContainer.classList.add("active");
  }
}, 2000);