(function () {
    const fbRenderContainer = document.getElementById("fb-render-container");
    const btnObterModificacaoFormulario = document.getElementById("btn-obter-modificacao-formulario");
    const btnSalvarFormulario = document.getElementById("btn-salvar-formulario");

    /*****************************
     * Teste
     *****************************/

    // Variável
    const formularioObtido = "[{\"type\":\"text\",\"required\":false,\"label\":\"Campo de texto\",\"className\":\"form-control\",\"name\":\"text-1702300570700-0\",\"access\":false,\"subtype\":\"text\",\"cdCampo\":0,\"userData\":[\"\"],\"value\":\"\"},{\"type\":\"number\",\"required\":false,\"label\":\"Número\",\"className\":\"form-control\",\"name\":\"number-1702300571475-0\",\"access\":false,\"subtype\":\"number\",\"cdCampo\":0,\"userData\":[\"\"],\"value\":\"\"},{\"type\":\"select\",\"required\":false,\"label\":\"Seleção\",\"className\":\"form-control\",\"name\":\"select-1702300573563-0\",\"access\":false,\"multiple\":false,\"values\":[{\"label\":\"Opção 1\",\"value\":\"opo-1-\",\"selected\":true},{\"label\":\"Opção 2\",\"value\":\"opo-2-\",\"selected\":false},{\"label\":\"Opção 3\",\"value\":\"opo-3-\",\"selected\":false}],\"cdCampo\":0,\"userData\":[\"\"],\"value\":\"\"},{\"type\":\"radio-group\",\"required\":false,\"label\":\"Grupo de opções\",\"inline\":false,\"name\":\"radio-group-1702300574299-0\",\"access\":false,\"other\":false,\"values\":[{\"label\":\"Opção 1\",\"value\":\"opo-1-\",\"selected\":true},{\"label\":\"Opção 2\",\"value\":\"opo-2-\",\"selected\":false},{\"label\":\"Opção 3\",\"value\":\"opo-3-\",\"selected\":false}],\"cdCampo\":0,\"userData\":[\"\"],\"value\":\"\"}]"

    const formData = formularioObtido;

    // localStorage
    // const formularioObtido = JSON.parse(localStorage.getItem("formBuilder"));
    // const formData = formularioObtido.strJson;

    /*****************************
     * Renderização
     *****************************/

    const fbOptions = {
        formData,
        i18n: {
            locale: "pt-BR",
            location: "../node_modules/formbuilder-languages/",
            //location: "https://formbuilder.online/assets/lang/",
            //location: "https://github.com/kevinchappell/formBuilder/",
        },
    };

    console.log(formData, formData.userData);

    // Sempre instancia o objeto ao renderizar
    const frInstance = $(fbRenderContainer).formRender(fbOptions);

    fbRenderContainer.addEventListener("render", () => {
        console.info("Renderizado!");
    });

    // Utilizando a propriedade userData da instância recuperamos todo o preenchimento do formulário
    console.log(frInstance.userData);

    /*****************************
     * Funções
     *****************************/

    /**
     * Obtém os valores dos campos redefinidos
     */
    function armazenarValoresDosCampos() {
        frInstance.userData.forEach((obj) => {
            // Copia o valor de userData para value
            if (obj.type === "text" || obj.type === "number" || obj.type === "textarea") {
                obj.value = obj.userData && obj.userData.length > 0 ? obj.userData[0] : null;
            } else if (obj.type === "checkbox-group") {
                if (obj.values[0].selected) obj.userData.push(obj.values[0].value);
            }

            //  Copia o valor de userData, acessa values e define a propriedade selected igual a true
            if (obj.type === "radio-group" || obj.type === "select") {
                if (obj.values && obj.values.length > 0) {
                    obj.values.forEach((valor) => {
                        valor.selected = valor.value === obj.value || (obj.userData && obj.userData.includes(valor.value));
                    });
                }
            }
        });

        console.log(frInstance.userData);
        console.log(JSON.stringify(frInstance.userData));
    }

    function destacarCamposObrigatorios() {
        const camposObrigatorios = document.querySelectorAll(".formbuilder-required");
        camposObrigatorios.forEach((campo) => {
            campo.style.fontSize = "x-small";
            campo.innerHTML = "&nbsp;(* Campo Obrigatório)";
        });
    }

    function formatarMascarasDeCampos() {
        $(".input-cpf").inputmask("999.999.999-99", { placeholder: "___.___.___-__" });
        $(".input-cnpj").inputmask("99.999.999/9999-99", { placeholder: "__.___.___/____-__" });
        $(".input-iptu").inputmask("9.99.99.999.999.9999-9", { placeholder: "_.__.__.___.___.____-_" });
        $(".input-data").inputmask("99/99/9999", { placeholder: "__/__/____" });
        $(".input-tel").inputmask("(99)9999-9999", { placeholder: "(__)____-____" });
        $(".input-cel").inputmask("(99)99999-9999", { placeholder: "(__)_____-____" });
    }

    function validarCamposObrigatorios() {
        const camposObrigatorios = document.querySelectorAll("#fb-render-container [required]");

        let formularioEhValido = true;

        camposObrigatorios.forEach((campo) => {
            if (!campo.value.trim()) formularioEhValido = false;
        });

        return formularioEhValido;
    }

    function enviarFormulario() {
        if (validarCamposObrigatorios() === false) return;

        armazenarValoresDosCampos();

        const actionResult = "/Home/SalvarFormulario";

        const formulario = {
            CdFormulario: 0,
            NmFormulario: "",
            CdSecretaria: 0,
            StrJson: JSON.stringify(frInstance.userData),
            CdCadUnico: 0,
        };

        console.log(formulario);

        return;

        $.ajax({
            url: actionResult,
            type: "POST",
            //contentType: "application/json",
            data: {
                formulario: formulario,
            },
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.error("Status: " + status);
                console.error("Error: " + error);
                console.error(xhr.responseText);
            },
        });
    }

    /*****************************
     * Inicialização
     *****************************/

    destacarCamposObrigatorios();
    formatarMascarasDeCampos();

    btnObterModificacaoFormulario.addEventListener("click", armazenarValoresDosCampos);
    btnSalvarFormulario.addEventListener("click", enviarFormulario);
})();
