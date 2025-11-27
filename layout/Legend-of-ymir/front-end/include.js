document.querySelectorAll("[include-html]").forEach(async el => {
    const file = el.getAttribute("include-html");
    const html = await fetch(file).then(r => r.text());
    el.innerHTML = html;
});