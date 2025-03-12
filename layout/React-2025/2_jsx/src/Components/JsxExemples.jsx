import React from "react";


const JsxExample = () => {

const userName = "carlos";

const user = {
    name: "Ana",
    LastName: "Souza",
};

function getGreeting(name){
    return `Olá ${name}`
}

const userIsLoggedIn = true;


const userRole = "Admin";

const users = [
    {id:1, name: "Leonardo"},
    {id:2, name: "Joaquim"},
    {id:3, name: "Alzira"},
]

    return (
        <div>
            <h2> Conteudo de texto </h2>


            <p>O nome do usuário é: {userName}</p>  
            <p>Usuário: {user.name} {user.LastName}</p>

            <p> {2 + 2 } </p>     

            <p> {getGreeting(userName)}</p>
            <p> {getGreeting("Leonardo")}</p>

        {/* DIFERENCAS HTML */}
        <div className="alguma-coisa">Este cara</div>
        
        <button onClick={() => alert("Teste")}>clique em mim</button>

        <input type="text" placeholder="Digite algo" />



            {/*RENDERIZACAO CONDICIONAL */ }
        {userIsLoggedIn ? (
            <div>
                <p>Caso: Está logado.</p>
                </div>)
                 : 
                 (<div>
                    <p>Caso: Não está Logado.</p>
                    </div>)}
        
        <p>
            {userRole === "Admin" && "Você é o Admin"}
        </p>

        {/*RENDERIZACAO DE LISTAS */}

        <div>
            <ul>
                {users.map((user) => (
                    <li key={user.id}>
                    {user.id} - {user.name}
                    </li>
                ))}
            </ul>
        </div>
       </div>
    );
};

export default JsxExample;