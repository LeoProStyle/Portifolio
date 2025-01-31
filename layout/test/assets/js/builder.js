(function () {
    const fbBuilderContainer = $(document.getElementById("fb-builder-container"));
    const btnLimparCampos = document.getElementById("btn-limpar-campos");
    const btnObterArrayDeObjetos = document.getElementById("btn-obter-arr-obj");
    const btnObterXML = document.getElementById("btn-obter-xml");
    const btnObterJSON = document.getElementById("btn-obter-json");
    const btnSalvar = document.getElementById("btn-salvar-formulario");

    /*************************************************
     * Redefinições dos itens da sidebar
     *************************************************/

    /**
     * Títulos dos itens
     */
    const txtItemText = "Campo de Texto";
    const txtItemNumber = "Campo Numérico";
    const txtItemSelect = "Campo de Seleção";
    const txtItemRadioButton = "Grupo de Opções";
    const txtItemCheckbox = "Grupo de Marcações";
    const txtItemTextarea = "Área de Texto";
    const txtItemCPF = "Campo de CPF";
    const txtItemCNPJ = "Campo de CNPJ";
    const txtItemIPTU = "Campo de IPTU";
    const txtItemData = "Campo de Data";
    const txtItemTelefone = "Campo de Telefone";
    const txtItemCelular = "Campo de Celular";
    const txtItemEmail = "Campo de E-mail";

    const itensOriginaisDaSidebar = [
        {
            ancestral: '.frmb-control [data-type="text"]',
            seletor: '.frmb-control [data-type="text"] span',
            tipo: "text",
            titulo: txtItemText,
        },
        {
            ancestral: '.frmb-control [data-type="number"]',
            seletor: '.frmb-control [data-type="number"] span',
            tipo: "number",
            titulo: txtItemNumber,
        },
        {
            ancestral: '.frmb-control [data-type="radio-group"]',
            seletor: '.frmb-control [data-type="radio-group"] span',
            tipo: "radio",
            titulo: txtItemRadioButton,
        },
        {
            ancestral: '.frmb-control [data-type="checkbox-group"]',
            seletor: '.frmb-control [data-type="checkbox-group"] span',
            tipo: "checkbox",
            titulo: txtItemCheckbox,
        },
        {
            ancestral: '.frmb-control [data-type="select"]',
            seletor: '.frmb-control [data-type="select"] span',
            tipo: "select",
            titulo: txtItemSelect,
        },
        {
            ancestral: '.frmb-control [data-type="textarea"]',
            seletor: '.frmb-control [data-type="textarea"] span',
            tipo: "textarea",
            titulo: txtItemTextarea,
        },
    ];

    /**
     * Definição da ordem de exibição dos itens
     */
    const ordenacaoDaExibicaoDosItensDaSidebar = [
        txtItemText,
        txtItemNumber,
        txtItemSelect,
        txtItemRadioButton,
        txtItemCheckbox,
        txtItemTextarea,
        txtItemData,
        txtItemCPF,
        txtItemTelefone,
        txtItemCelular,
        txtItemEmail,
        txtItemCNPJ,
        txtItemIPTU,
    ];

    /***************************************
     * Opções do formBuilder
     ***************************************/

    const fbOptions = {
        i18n: {
            locale: "pt-BR",
            location: "../node_modules/formbuilder-languages/",
            //location: "https://formbuilder.online/assets/lang/",
            //location: "https://github.com/kevinchappell/formBuilder/",
        },
        disableFields: ["autocomplete", "file", "date", "paragraph", "button", "header", "hidden"],
        controlPosition: "left",
        scrollToFieldOnAdd: false,
        controlOrder: ["text", "number", "textarea", "radio-group", "checkbox-group", "select"],
        onAddFieldAfter: (field, fieldData) => {
            console.log(field, fieldData);

            removerEstiloCSSInlinePredefinido();

            if (fieldData.type === "text" && fieldData.className !== "form-control") formatarMascarasDeCampos();
            if (fieldData.type === "textarea") restringirQuantidadeMinimaDeLinhasEmTextarea();
            if (fieldData.type === "radio-group") marcarPrimeiraOpcaoDoGrupoDeRadioButtons(field);
        },
        onOpenFieldEdit: (editPanel) => {
            redefinirLabelDeOpcaoDeCampoObrigatorio(editPanel, "Obrigatório");
            console.log(editPanel);
        },
        onCloseFieldEdit: (editPanel) => {
            console.log(editPanel);
        },
        notify: {
            error: (message) => {
                console.error(message);
            },
            success: (message) => {
                console.log(message);
            },
            warning: (message) => {
                console.warn(message);
            },
        },
        fields: [
            {
                label: txtItemCPF,
                type: "text",
                className: "form-control input-cpf",
                icon: '<i class="bi bi-person-vcard"></i>',
            },
            {
                label: txtItemCNPJ,
                type: "text",
                className: "form-control input-cnpj",
                icon: '<i class="bi bi-credit-card-2-front"></i>',
            },
            {
                label: txtItemIPTU,
                type: "text",
                className: "form-control input-iptu",
                icon: '<i class="bi bi-house"></i>',
            },
            {
                label: txtItemData,
                type: "text",
                className: "form-control input-data",
                icon: '<i class="bi bi-calendar"></i>',
            },
            {
                label: txtItemTelefone,
                type: "text",
                className: "form-control input-tel",
                icon: '<i class="bi bi-telephone"></i>',
            },
            {
                label: txtItemCelular,
                type: "text",
                className: "form-control input-cel",
                icon: '<i class="bi bi-phone"></i>',
            },
            {
                label: txtItemEmail,
                type: "text",
                className: "form-control input-email",
                icon: '<i class="bi bi-send"></i>',
            },
        ],
    };

    /***************************************
     * Funções: Assistir formBuilder
     ***************************************/

    /**
     * Observa a inserção de elementos no container do formBuilder e invoca um callback
     */
    function observarInicializacao(container, callback) {
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // Verifica se as mudanças são relacionadas à lista de filhos do container
                if (mutation.type === "childList") {
                    // Itera sobre os nós adicionados à lista de filhos
                    mutation.addedNodes.forEach((noAdicionado) => {
                        // Chama a função de callback para processar o novo nó
                        callback(noAdicionado);
                    });
                }
            });
        });

        mutationObserver.observe(container[0], { childList: true, subtree: true });
    }

    function reconfigurarItensListadosNaSidebar() {
        const redefinirTitulo = (seletor, texto) => (document.querySelector(seletor).innerHTML = texto);

        itensOriginaisDaSidebar.forEach((item) => redefinirTitulo(item.seletor, item.titulo));

        document.querySelector(itensOriginaisDaSidebar[5].ancestral).closest("li").style.color = "#aa0000";
    }

    function ordenarItensListadosNaSidebar(array) {
        const containerDaSidebar = document.querySelector(".cb-wrap.pull-left");
        containerDaSidebar.classList.remove("pull-left");

        const sidebar = document.querySelector(".frmb-control.ui-sortable");
        const itensOriginaisDaSidebar = Array.from(sidebar.children);

        const elementosDesordenados = new Map(
            itensOriginaisDaSidebar.map((elemento, index) => {
                const textoSpan = elemento.querySelector("span").textContent;
                return [textoSpan, elemento];
            })
        );

        const elementosOrdenados = array.map((texto) => elementosDesordenados.get(texto)).filter((elemento) => elemento !== undefined);

        itensOriginaisDaSidebar.forEach((elemento) => sidebar.removeChild(elemento));
        elementosOrdenados.forEach((elemento) => sidebar.appendChild(elemento));
    }

    /**
     * Garante que as funções que reconfiguram as predefinições sejam executadas após a inicialização
     */
    function reconfigurarPredefinicoes(noAdicionado) {
        if (noAdicionado.classList && noAdicionado.classList.contains("form-wrap")) {
            reconfigurarItensListadosNaSidebar();
            ordenarItensListadosNaSidebar(ordenacaoDaExibicaoDosItensDaSidebar);
        }
    }

    /***************************************
     * Funções: Manipulação de Campos
     ***************************************/

    function removerEstiloCSSInlinePredefinido() {
        [
            ".form-elements .description-wrap",
            ".form-elements .placeholder-wrap",
            ".form-elements .className-wrap",
            ".form-elements .name-wrap",
            ".form-elements .value-wrap",
        ].forEach((classe) => {
            const elementos = document.querySelectorAll(classe);
            elementos.forEach((elemento) => elemento.removeAttribute("style"));
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

    function restringirQuantidadeMinimaDeLinhasEmTextarea() {
        const campos = document.querySelectorAll('.textarea-field .rows-wrap input[type="number"]');

        campos.forEach((campo) => {
            campo.addEventListener("input", function (e) {
                const campo = e.target;
                campo.value = campo.value === "0" ? "1" : campo.value.replace(/\D/g, "");
            });
        });
    }

    function marcarPrimeiraOpcaoDoGrupoDeRadioButtons(campoID) {
        document.querySelector(`#${campoID} .formbuilder-radio`).firstElementChild.click();
    }

    function redefinirLabelDeOpcaoDeCampoObrigatorio(editPanel, texto) {
        ["text-field", "number-field", "textarea-field"].forEach((tipo) => {
            if (editPanel.closest("li").classList.contains(tipo)) editPanel.querySelector(".required-wrap label").innerHTML = texto;
        });
    }

    /***************************************
     * Funções: Ações
     ***************************************/

    const limparCampos = () => formBuilder.actions.clearFields();
    const obterArrayDeObjetos = () => formBuilder.actions.getData();
    const obterJSON = () => formBuilder.actions.getData("json");
    const obterXML = () => formBuilder.actions.getData("xml");

    /**
     * Enviar o formulário se for válido
     */
    function enviarFormulario() {
        const arrObjObtido = obterArrayDeObjetos();
        const validar = (arr) => arr.length > 0;

        if (!validar(arrObjObtido)) return;

        console.log(arrObjObtido);

        /**
         * Gera propriedades para a renderização do array de objetos no método render
         */
        const adicionarPropriedadesNoObjeto = (arrObj) => {
            arrObj.forEach((obj) => {
                obj.cdCampo = 0;

                // userData é um array que armazena o valor ou valores dos campos, essencial na renderização
                if (obj.type === "checkbox-group") {
                    obj.userData = [];
                    for (let i = 0; i < obj.values.length; i++) obj.userData.push("");
                } else obj.userData = [""];

                if (obj.type === "text" || obj.type === "number" || "textarea") obj.value = "";

                obj.label = obj.label.replaceAll("\n", "");
            });

            return arrObj;
        };

        adicionarPropriedadesNoObjeto(arrObjObtido);

        const form = {
            nmFormulario: "",
            cdSecretaria: 0,
            strJson: JSON.stringify(arrObjObtido),
        };

        console.log(JSON.stringify(form));

        simular(JSON.stringify(form));

        return;

        $.ajax({
            url: "",
            type: "POST",
            //contentType: "application/json",
            data: JSON.stringify(form),
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.error(error);
            },
        });
    }

    /***************************************
     * Teste
     ***************************************/

    /**
     * Insere um registro no localStorage, simulando uma gravação
     *
     * Abra o arquivo render.html no navegador
     */
    const simular = (json) => localStorage.setItem("formBuilder", json);

    /***************************************
     * Inicialização do formBuilder
     ***************************************/

    /**
     * Inicializa o formBuilder com as opções definidas
     */
    const formBuilder = $(fbBuilderContainer).formBuilder(fbOptions);

    btnLimparCampos.addEventListener("click", limparCampos);
    btnObterArrayDeObjetos.addEventListener("click", obterArrayDeObjetos);
    btnObterXML.addEventListener("click", obterXML);
    btnObterJSON.addEventListener("click", obterJSON);
    btnSalvar.addEventListener("click", enviarFormulario);

    document.addEventListener("readystatechange", () => {
        if (document.readyState === "interactive") {
            console.info("Carregando");
            observarInicializacao(fbBuilderContainer, reconfigurarPredefinicoes);
        }

        if (document.readyState === "complete") {
            console.info("Carregamento completo");
        }
    });
})();
