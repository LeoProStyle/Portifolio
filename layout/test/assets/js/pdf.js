const formularioObtido = [
    {
        type: "text",
        required: false,
        label: "Campo de texto",
        className: "form-control",
        name: "text-1702044371505-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "number",
        required: false,
        label: "Número",
        className: "form-control",
        name: "number-1702044372624-0",
        access: false,
        subtype: "number",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "select",
        required: false,
        label: "Seleção",
        className: "form-control",
        name: "select-1702044373577-0",
        access: false,
        multiple: false,
        values: [
            { label: "Opção 1", value: "opo-1-", selected: true },
            { label: "Opção 2", value: "opo-2-", selected: false },
            { label: "Opção 3", value: "opo-3-", selected: false },
        ],
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "radio-group",
        required: false,
        label: "Grupo de opções",
        inline: false,
        name: "radio-group-1702044374377-0",
        access: false,
        other: false,
        values: [
            { label: "Opção 1", value: "opo-1-", selected: true },
            { label: "Opção 2", value: "opo-2-", selected: false },
            { label: "Opção 3", value: "opo-3-", selected: false },
        ],
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "checkbox-group",
        required: false,
        label: "Grupo de seleção",
        toggle: false,
        inline: false,
        name: "checkbox-group-1702044375129-0",
        access: false,
        other: false,
        values: [{ label: "Opção 1", value: "opo-1-", selected: true }],
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "textarea",
        required: false,
        label: "Área de texto",
        className: "form-control",
        name: "textarea-1702044375849-0",
        access: false,
        subtype: "textarea",
        rows: 1,
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de Data",
        className: "form-control input-data",
        name: "text-1702044378777-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de CPF",
        className: "form-control input-cpf",
        name: "text-1702044379665-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de Telefone",
        className: "form-control input-tel",
        name: "text-1702044380473-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de Celular",
        className: "form-control input-cel",
        name: "text-1702044381937-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de E-mail",
        className: "form-control input-email",
        name: "text-1702044388097-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de CNPJ",
        className: "form-control input-cnpj",
        name: "text-1702044389289-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
    {
        type: "text",
        required: false,
        label: "Campo de CNPJ",
        className: "form-control input-cnpj",
        name: "text-1702044389315-0",
        access: false,
        subtype: "text",
        cdCampo: 0,
        userData: [""],
        value: "",
    },
];

function carregarArray(array) {
    let arrayReestruturado = [];

    array.forEach((formulario) => {
        let userData;

        // Checa os tipos de campos e trata os valores
        if (formulario.type === "text" || formulario.type === "number" || formulario.type === "textarea") {
            if (formulario.userData[0] === "") userData = "-";
        }

        if (formulario.type === "radio-group" || formulario.type === "select") {
            if (formulario.values && formulario.values.length > 0) {
                formulario.values.forEach((valor) => {
                    console.log(valor);
                    if (valor.selected) userData = valor.label;
                });
            }
        }

        if (formulario.type === "checkbox-group") {
            if (formulario.values && formulario.values.length > 0) {
                if (formulario.values[0].selected) userData = "Sim";
                else userData = "Não";
            }
        }

        arrayReestruturado.push([formulario.label, userData]);
    });

    return arrayReestruturado;
}

function gerarPDF() {
    const dataHoraAtuais = new Date().toLocaleDateString("pt-BR", { hour: "numeric", minute: "numeric", second: "numeric" });

    const doc = new window.jspdf.jsPDF({
        //orientation: "landscape",
    });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(20);
    doc.text("Município da Estância Balneária de Praia Grande", 42, 22);
    doc.addImage("assets/img/brasao-colorido.png", "JPEG", 15, 15, 18, 18);

    doc.setFont("times", "normal");
    doc.setFontSize(16);
    doc.text("Estado de São Paulo", 95.5, 30);

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("SECRETARIA DE FINANÇAS", 105, 48, null, null, "center");

    doc.setFont("times", "normal");
    doc.setFontSize(14);
    doc.text("Agendamento de Serviço(os)", 105, 60, null, null, "center");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Gerado em: " + dataHoraAtuais.replace(", ", " "), 181.5, 48, null, null, "center");

    // Centralizar
    let wantedTableWidth = 100;
    let pageWidth = doc.internal.pageSize.width;
    let margin = (pageWidth - wantedTableWidth) / 2;

    doc.autoTableSetDefaults({
        headStyles: {
            fillColor: 0,
        },
        styles: {
            fontSize: 8,
        },
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 132 }, // Ajustar até o fim da página
        },
    });

    doc.autoTable({
        head: [
            ["Item", "Item"], // Define os títulos das colunas
        ],
        body: [...carregarArray(formularioObtido)], // Array com os valores
        startY: 50,
        showHead: "never", // Desativa as colunas
        //theme: "grid", // grid ou plain. striped é default
        //margin: { left: margin, right: margin }, Centralizar a tabela
    });

    // Inserir texto após a tabela
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.text("...", 15, doc.autoTable.previous.finalY + 10);

    // Adicionar uma nova tabela
    doc.autoTable({
        head: [["Item", "Item"]],
        body: [...carregarArray(formularioObtido)],
        startY: doc.autoTable.previous.finalY + 20, // Posição inicial ajustada para começar após o texto
        showHead: "never",
        theme: "grid",
    });

    function addRodape(doc) {
        const pageCount = doc.internal.getNumberOfPages();

        //doc.setFont("helvetica", "italic");
        doc.setFontSize(8);

        for (var i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            // doc.text("Página " + String(i) + " de " + String(pageCount), doc.internal.pageSize.width / 2, 287, {
            //     align: "center",
            // });
            doc.text("Página " + String(i) + " de " + String(pageCount), 187, 287, {
                align: "center",
            });
        }
    }

    addRodape(doc);

    const arquivo = "Requerimento-" + dataHoraAtuais.replace(", ", "_");

    doc.save(arquivo);
}

document.getElementById("btn-gerar-pdf").addEventListener("click", gerarPDF);
