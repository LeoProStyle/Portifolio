const form = document.querySelector('form');
const fullName = document.getElementById("nome");
const email = document.getElementById("email");
const telefone = document.getElementById("telefone");
const assunto = document.getElementById("assunto");
const mensagem = document.getElementById("message");

function sendEmail(){
    const bodyMenssage = `Nome Completo: ${fullName.value}<br> Email: ${email.value} <br> telefone: ${telefone.value}<br> mensagem: ${mensagem.value}`;

//  smtp.elasticemail.com
    Email.send({
        SecureToken:"def5e928-0e3e-474f-b06e-0ee9e4280a43",             
        To : 'leoprostyle3@gmail.com',
        From : "leoprostyle3@gmail.com",
        Subject : assunto.value,
        Body : bodyMenssage
    }).then(
      message => {
        if (message == "OK"){
            Swal.fire({
                title: "Sucesso!",
                text: "Mensagem enviada com Sucesso!",
                icon: "success"
              });
        }
      }
    );
}

function checkInputs() {
    const items = document.querySelectorAll(".item");

    for (const item of items){
        if (item.value == ""){
            item.classList.add("error");
            item.parentElement.classList.add("error");
        }

        if (items[1].value != ""){
            checkEmail();
        }

        items[1].addEventListener("keyup", () => {
            checkEmail();
        });

        item.addEventListener("keyup", () => {
            if (item.value != ""){
                item.classList.remove("error");
                item.parentElement.classList.remove("error");
            }
            else{
                item.classList.add("error");
            item.parentElement.classList.add("error");
            }
        });
    }
}

function checkEmail(){
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}])|(([a-zA-Z-0-9]+.)+[a-zA-Z]{2,}))$/;

    const errorTxtEmail = document.querySelector(".error-txt.email");

    if (!email.value.match(emailRegex)) {
        email.classList.add("error");
        email.parentElement.classList.add("error");

        if(email.value != ""){
            errorTxtEmail.innerText = "Entre com um email válido"
        }
        else{
            errorTxtEmail.innerText = "Email não pode estar em branco."
        }
    }
    else {
        email.classList.remove("error");
        email.parentElement.classList.remove("error");
    }
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    checkInputs();

    if (!fullName.classList.contains("error") && 
    !email.classList.contains("error") && 
    !telefone.classList.contains("error") && 
    !assunto.classList.contains("error") && 
    !mensagem.classList.contains("error")) {
        sendEmail();

        form.reset();
        return false;
    }
});