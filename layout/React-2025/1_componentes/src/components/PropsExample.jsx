import React from "react";

/* exemplo de props */
const PropsExample = (nome , idade) => {
    return (
        <div>
            <h3>olá {nome}</h3>
            <p> Eu tenho {idade} anos.</p>
        </div>
    );
};

export default PropsExample;