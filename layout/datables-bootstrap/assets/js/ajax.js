$(document).ready(function () {
    $(".table").DataTable({
        ajax: {
            url: "assets/json/employees.json",
            dataSrc: "",
        },
        language: {
            url: "assets/i18n/pt-BR.json",
        },
        columns: [
            {
                data: "ID",
            },
            {
                data: "Name",
            },
            {
                data: "Position",
            },
            {
                data: "Office",
            },
            {
                data: "Age",
            },
            {
                data: "Start",
            },
            {
                data: "Salary",
            },
        ],
    });
});